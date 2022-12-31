import {
  type ClientConnection,
  Signal,
  Slot,
  MasterGame,
} from '@nekosu/game-framework'
import { type InnerMsg, type $MasterGame } from '@sctavern-emulator/emulator'
import { WebSocketServer, WebSocket } from 'ws'

export function WebsockConnect(sock: WebSocket): ClientConnection<InnerMsg> {
  const conns: ClientConnection<InnerMsg> = {
    signal: new Signal(),
    slot: new Slot(),
  }
  sock.on('message', data => {
    conns.signal.emit(JSON.parse(data.toString()) as InnerMsg)
  })
  conns.slot.bind(async item => {
    sock.send(JSON.stringify(item))
  })
  return conns
}

class Server {
  server: WebSocketServer
  adapters: ClientConnection<InnerMsg>[]

  constructor() {
    this.server = new WebSocketServer({
      port: 8080,
    })
    this.adapters = []

    this.server.on('connection', conn => {
      console.log('in')
      const cc = WebsockConnect(conn)
      this.adapters.push(cc)
      if (this.adapters.length === 2) {
        console.log('start')
        const game: $MasterGame = new MasterGame(this.adapters)
        this.adapters = []
        game.poll()
      }
    })
  }
}

new Server()
