import { Signal, RemoteServer, type IWebSocket } from '@nekosu/game-framework'
import { type InnerMsg } from '@sctavern-emulator/emulator'
import { WebSocketServer } from 'ws'

new RemoteServer<InnerMsg>(
  {
    clientFactory: () => null,
    serverFactory: port => {
      const srv = {
        server: new WebSocketServer({
          port,
        }),
        connected: new Signal<IWebSocket>(),
      }
      srv.server.on('connection', socket => {
        const s: IWebSocket = {
          recv: new Signal(),
          send: new Signal(),
          status: new Signal(),
          ctrl: new Signal(),
        }
        socket.on('open', () => {
          s.status.emit('open')
        })
        socket.on('close', () => {
          s.status.emit('close')
        })
        s.ctrl.connect(async req => {
          switch (req) {
            case 'close':
              socket.close()
              break
          }
        })
        s.send.connect(async item => {
          socket.send(item)
        })
        socket.on('message', data => {
          s.recv.emit(data.toString())
        })
        srv.connected.emit(s)
      })
      return srv
    },
  },
  8080,
  2
)
