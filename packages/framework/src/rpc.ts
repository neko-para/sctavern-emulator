import { Err, pErr, Result, type tPlainResult, type tResult } from './result'
import { Compress, Decompress } from './utils'
import type {
  IWebSocket,
  IWebSocketClientFactory,
  IWebSocketServer,
  IWebSocketServerFactory
} from './websock'

interface RpcServiceDefinition {
  service: {
    [key: string]: {
      request: object
      respond: unknown
      error: unknown
    }
  }
  notify: {
    [key: string]: unknown
  }
}

type ServiceKeys<T extends RpcServiceDefinition> = keyof T['service'] & string
type NotifyKeys<T extends RpcServiceDefinition> = keyof T['notify'] & string

type ServiceRequest<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T>
> = T['service'][M]['request']

type ServiceRespond<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T>
> = T['service'][M]['respond']

type ServiceError<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T>
> = T['service'][M]['error']

type ServicePlainResult<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T>
> = tPlainResult<ServiceRespond<T, M>, ServiceError<T, M>>

type ServiceResult<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T>
> = tResult<ServiceRespond<T, M>, ServiceError<T, M>>

type NotifyRequest<
  T extends RpcServiceDefinition,
  M extends NotifyKeys<T>
> = T['notify'][M]

interface RpcRequestPayload<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T> = ServiceKeys<T>
> {
  $request: M
  $id: number
  $payload: ServiceRequest<T, M>
}

interface RpcRespondPayload<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T> = ServiceKeys<T>
> {
  $type: 'respond'
  $request: M
  $id: number
  $payload: ServicePlainResult<T, M>
}

interface RpcNotifyPayload<
  T extends RpcServiceDefinition,
  M extends NotifyKeys<T> = NotifyKeys<T>
> {
  $type: 'notify'
  $request: M
  $payload: NotifyRequest<T, M>
}

export type RpcNotifier<T extends RpcServiceDefinition> = <
  MM extends NotifyKeys<T>
>(
  m: MM,
  n: NotifyRequest<T, MM>
) => Promise<void>

type RpcService<T extends RpcServiceDefinition> = {
  [M in ServiceKeys<T>]: (
    request: ServiceRequest<T, M>,
    notify: RpcNotifier<T>
  ) => Promise<ServiceResult<T, M>>
}

export class WsRpcServer<T extends RpcServiceDefinition> {
  server: IWebSocketServer
  service: RpcService<T>

  constructor(
    factory: IWebSocketServerFactory,
    port: number,
    service: RpcService<T>,
    started: () => void
  ) {
    this.server = factory(port)
    this.service = service

    this.server.status.connect(async item => {
      if (item === 'listening') {
        started()
      }
    })
    this.server.connected.connect(async sock => {
      sock.recv.connect(async payload => {
        const msg = Decompress<RpcRequestPayload<T>>(payload)
        if (!msg) {
          throw 'JSON Parse Failed'
        }
        this.service[msg.$request](msg.$payload, async (request, payload) => {
          await sock.send.emit(
            Compress<RpcNotifyPayload<T>>({
              $type: 'notify',
              $request: request,
              $payload: payload
            })
          )
        })
          .then(respond => {
            sock.send.emit(
              Compress<RpcRespondPayload<T>>({
                $type: 'respond',
                $request: msg.$request,
                $id: msg.$id,
                $payload: respond.plain()
              })
            )
          })
          .catch(error => {
            sock.send.emit(
              Compress<RpcRespondPayload<T>>({
                $type: 'respond',
                $request: msg.$request,
                $id: msg.$id,
                $payload: pErr(error)
              })
            )
          })
      })
      sock.status.connect(async item => {
        if (item === 'close') {
          sock.recv.disconnect(null)
          sock.status.disconnect(null)
        }
      })
    })
  }

  close() {
    this.server.connected.disconnect(null)
    this.server.ctrl.emit('close')
  }
}

interface PendingRequest<
  T extends RpcServiceDefinition,
  M extends ServiceKeys<T> = ServiceKeys<T>
> {
  $request: M
  $id: number
  $resolve: (res: ServiceResult<T, M>) => void
}

type RpcNotify<T extends RpcServiceDefinition> = {
  [MM in NotifyKeys<T>]?: (payload: NotifyRequest<T, MM>) => void
}

export const ClientSymbol = Symbol('client')

type RpcClientService<T extends RpcServiceDefinition> = {
  [M in ServiceKeys<T>]: (
    payload: ServiceRequest<T, M>
  ) => Promise<ServiceResult<T, M>>
} & {
  [ClientSymbol]: WsRpcClient<T>
  then: undefined // when resolving, mark as non thenable
}

export class WsRpcClient<T extends RpcServiceDefinition> {
  socket: IWebSocket
  pending: PendingRequest<T>[]
  id: number
  notify: RpcNotify<T>
  $: RpcClientService<T>

  static create<T extends RpcServiceDefinition>(
    factory: IWebSocketClientFactory,
    url: string,
    notify?: RpcNotify<T>
  ) {
    return new Promise<RpcClientService<T>>(resolve => {
      new WsRpcClient<T>(
        factory,
        url,
        function () {
          resolve(this.$)
        },
        notify
      )
    })
  }

  constructor(
    factory: IWebSocketClientFactory,
    url: string,
    started: (this: WsRpcClient<T>) => void,
    notify?: RpcNotify<T>
  ) {
    this.socket = factory(url)
    this.pending = []
    this.id = 1
    this.notify = notify || {}
    this.$ = new Proxy(
      {
        [ClientSymbol]: this
      },
      {
        get<M extends ServiceKeys<T>>(
          target: {
            [ClientSymbol]: WsRpcClient<T>
          },
          key: M | 'then' | typeof ClientSymbol
        ):
          | ((payload: ServiceRequest<T, M>) => Promise<ServiceResult<T, M>>)
          | undefined
          | WsRpcClient<T> {
          if (key === 'then') {
            return undefined
          } else if (key === ClientSymbol) {
            return target[ClientSymbol]
          } else {
            return payload => {
              return target[ClientSymbol].request(key, payload)
            }
          }
        }
      }
    ) as unknown as RpcClientService<T>

    this.socket.status.connect(async item => {
      if (item === 'open') {
        started.call(this)
      }
    })

    this.socket.recv.connect(async item => {
      const msg = Decompress<RpcRespondPayload<T> | RpcNotifyPayload<T>>(item)
      if (!msg) {
        throw 'JSON Parse Failed'
      }
      if (msg.$type === 'respond') {
        const pos = this.pending.findIndex(({ $id }) => msg.$id === $id)
        if (pos === -1) {
          return
        }
        const pr = this.pending.splice(pos, 1)[0]
        if (pr.$request === msg.$request) {
          pr.$resolve(Result(msg.$payload))
        } else {
          throw 'Responding Method Not Matched'
        }
      } else {
        this.notify[msg.$request]?.(msg.$payload)
      }
    })
  }

  close() {
    this.socket.recv.disconnect(null)
    this.socket.status.disconnect(null)
    this.socket.ctrl.emit('close')
  }

  request<M extends ServiceKeys<T>>(
    method: M,
    payload: ServiceRequest<T, M>
  ): Promise<ServiceResult<T, M>> {
    return new Promise(resolve => {
      this.socket.send.emit(
        Compress<RpcRequestPayload<T, M>>({
          $request: method,
          $id: this.id,
          $payload: payload
        })
      )
      this.pending.push({
        $request: method,
        $id: this.id,
        $resolve: resolve
      })
      this.id += 1
    })
  }
}
