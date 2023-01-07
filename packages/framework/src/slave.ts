import { AsyncQueue } from './queue'
import { WsRpcClient, WsRpcServer, type RpcNotifier } from './rpc'
import { Signal } from './signal'
import type { Client, Game } from './types'
import type {
  IWebSocketClientFactory,
  IWebSocketServerFactory,
  IWebSocketServer,
} from './websock'
import { Ok } from './result'

class SlaveEventLoop<
  InputMessage,
  OutputMessage,
  G extends Game<InputMessage, OutputMessage>
> {
  game: SlaveGame<InputMessage, OutputMessage, G>

  constructor(g: SlaveGame<InputMessage, OutputMessage, G>) {
    this.game = g
  }

  async exec(quit: () => boolean) {
    while (!quit()) {
      const item = await this.game.queue.pop()
      await this.game.game.$game.emit(item)
    }
  }
}

export class SlaveGame<
  InputMessage,
  OutputMessage,
  G extends Game<InputMessage, OutputMessage>
> implements ClientConnection<InputMessage>
{
  game: G
  loop: SlaveEventLoop<InputMessage, OutputMessage, G>
  queue: AsyncQueue<InputMessage>
  $fromServer: Signal<InputMessage>
  $toServer: Signal<InputMessage>

  constructor(
    config: object,
    gameFactory: (
      sg: SlaveGame<InputMessage, OutputMessage, G>,
      config: object
    ) => G
  ) {
    this.game = gameFactory(this, config)
    this.loop = new SlaveEventLoop(this)
    this.queue = new AsyncQueue()

    this.$fromServer = this.queue.pushSig()
    this.$toServer = new Signal()
  }

  async poll(quit: () => boolean = () => false) {
    await this.loop.exec(quit)
  }

  bind<T extends Client<InputMessage, OutputMessage, G>>(
    clientFactory: (sg: SlaveGame<InputMessage, OutputMessage, G>) => T
  ): T {
    const client = clientFactory(this)
    this.game.$client.connect(client.$recv)
    client.$send.connect(this.$toServer)
    return client
  }
}

export interface ClientConnection<InputMessage> {
  $toServer: Signal<InputMessage>
  $fromServer: Signal<InputMessage>
}

export class MasterGame<InputMessage> {
  connections: ClientConnection<InputMessage>[]
  queue: AsyncQueue<InputMessage>

  constructor(conns: ClientConnection<InputMessage>[]) {
    this.connections = conns
    this.queue = new AsyncQueue()
    const s = this.queue.pushSig()
    conns.forEach(c => {
      c.$toServer.connect(s)
    })
  }

  async poll(quit: () => boolean = () => false) {
    const signal = new Signal<InputMessage>()
    this.connections.forEach(c => {
      signal.connect(c.$fromServer)
    })
    while (!quit()) {
      const item = await this.queue.pop()
      await signal.emit(item, true)
    }
  }
}

export class LocalGame<
  InputMessage,
  OutputMessage,
  G extends Game<InputMessage, OutputMessage>
> {
  master: MasterGame<InputMessage>
  slaves: SlaveGame<InputMessage, OutputMessage, G>[]

  constructor(
    config: object,
    gameFactories: ((
      sg: SlaveGame<InputMessage, OutputMessage, G>,
      config: object
    ) => G)[]
  ) {
    this.slaves = gameFactories.map(g => new SlaveGame(config, g))
    this.master = new MasterGame(this.slaves)
  }

  start(
    f: (sg: SlaveGame<InputMessage, OutputMessage, G>, idx: number) => void
  ) {
    this.master.poll()
    this.slaves.forEach((s, i) => {
      s.poll()
      f(s, i)
    })
  }
}

type RemoteGameRpcDefinition<InputMessage> = {
  service: {
    login: {
      request: {
        uid: string
        gid: string
      }
      respond: false | object
      error: null
    }
    input: {
      request: {
        uid: string
        gid: string
        input: InputMessage
      }
      respond: boolean
      error: null
    }
  }
  notify: {
    input: InputMessage
  }
}

export class RemoteGame<
  InputMessage,
  OutputMessage,
  G extends Game<InputMessage, OutputMessage>
> {
  slave: null | SlaveGame<InputMessage, OutputMessage, G>

  constructor(
    gameFactory: (sg: SlaveGame<InputMessage, OutputMessage, G>) => G,
    wsFactory: IWebSocketClientFactory,
    url: string,
    uid: string,
    gid: string,
    init: (sg: SlaveGame<InputMessage, OutputMessage, G>) => void
  ) {
    this.slave = null
    WsRpcClient.create<RemoteGameRpcDefinition<InputMessage>>(wsFactory, url, {
      input: async input => {
        await this.slave?.$fromServer.emit(input)
      },
    }).then(async $ => {
      const cfg = await $.login({
        uid,
        gid,
      }).then(v => v.unwrap())
      if (cfg) {
        this.slave = new SlaveGame(cfg, gameFactory)
        this.slave.$toServer.connect(async input => {
          $.input({
            uid,
            gid,
            input,
          })
        })
        this.slave.poll()

        init(this.slave)
      }
    })
  }
}

interface GameConnectionInfo<InputMessage> {
  config: object
  game: MasterGame<InputMessage> | null
  user: string[]
  info: Record<
    string,
    {
      conn: ClientConnection<InputMessage>
      notifier: RpcNotifier<RemoteGameRpcDefinition<InputMessage>>
    }
  >
}

export class RemoteServer<InputMessage> {
  server: WsRpcServer<RemoteGameRpcDefinition<InputMessage>>
  game: Record<string, GameConnectionInfo<InputMessage>>

  constructor(factory: IWebSocketServerFactory, port: number) {
    this.server = new WsRpcServer<RemoteGameRpcDefinition<InputMessage>>(
      factory,
      port,
      {
        login: async ({ uid, gid }, notifier) => {
          if (!(gid in this.game)) {
            return Ok(false)
          }
          const info: GameConnectionInfo<InputMessage> = this.game[gid]
          if (!info.user.includes(uid) || uid in info.info) {
            return Ok(false)
          }
          const conn: ClientConnection<InputMessage> = {
            $toServer: new Signal(),
            $fromServer: new Signal(),
          }
          conn.$fromServer.connect(async item => {
            await notifier('input', item)
          })
          info.info[uid] = {
            conn,
            notifier,
          }
          if (Object.keys(info.info).length === info.user.length) {
            info.game = new MasterGame<InputMessage>(
              info.user.map(uid => info.info[uid].conn)
            )
            info.game.poll()
          }
          return Ok(info.config)
        },
        input: async ({ uid, gid, input }) => {
          if (!(gid in this.game)) {
            return Ok(false)
          }
          const info = this.game[gid]
          if (!info.user.includes(uid)) {
            return Ok(false)
          }
          await info.info[uid].conn.$toServer.emit(input)
          return Ok(true)
        },
      },
      () => {
        //
      }
    )
    this.game = {}
  }

  add(gid: string, user: string[], config: object) {
    if (gid in this.game) {
      return false
    }
    this.game[gid] = {
      config,
      game: null,
      user,
      info: {},
    }
  }
}
