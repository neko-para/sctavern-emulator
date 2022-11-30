import { Adapter, LogItem, InputBus, MasterGame } from '@sctavern-emulator/emulator'
import { WebSocketServer, WebSocket } from 'ws'

class ServerAdapter implements Adapter {
  onPosted: (item: LogItem) => void
  sock: WebSocket

  async post<T extends keyof InputBus>(msg: T, param: InputBus[T]) {
    this.sock.send(
      JSON.stringify({
        msg,
        param,
      })
    )
  }

  constructor(conn: WebSocket) {
    this.onPosted = () => {}

    this.sock = conn
    this.sock.on('message', data => {
      this.onPosted(JSON.parse(data.toString()) as LogItem)
    })
  }
}

class Server {
  server: WebSocketServer
  adapters: ServerAdapter[]

  constructor() {
    this.server = new WebSocketServer({
      port: 8080,
    })
    this.adapters = []

    this.server.on('connection', conn => {
      console.log('in')
      this.adapters.push(new ServerAdapter(conn))
      if (this.adapters.length === 2) {
        const game = new MasterGame(this.adapters)
        this.adapters = []
        game.poll()
        game.adapter
      }
    })
  }
}

new Server()
