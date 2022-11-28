import { Adapter, LogItem, InputBus } from 'emulator'
import { WebSocketServer, WebSocket } from 'ws'

// 不知道为什么, 但是直接import MasterGame会提示找不到

class LogQueue {
  items: LogItem[]
  resolve: ((item: LogItem) => void) | null

  constructor() {
    this.items = []
    this.resolve = null
  }

  push(item: LogItem) {
    if (this.resolve) {
      const r = this.resolve
      this.resolve = null
      r(item)
    } else {
      this.items.push(item)
    }
  }

  async pop(): Promise<LogItem> {
    if (this.items.length > 0) {
      return this.items.shift() as LogItem
    } else {
      return new Promise<LogItem>(resolve => {
        this.resolve = resolve
      })
    }
  }
}

class MasterGame {
  adapter: Adapter[]
  queue: LogQueue

  constructor(adapter: Adapter[]) {
    this.adapter = adapter
    this.queue = new LogQueue()

    this.adapter.forEach(ad => {
      ad.onPosted = item => {
        console.log(item)
        this.queue.push(item)
      }
    })
  }

  async poll() {
    while (true) {
      const item = await this.queue.pop()
      const pros: Promise<void>[] = []
      for (const ad of this.adapter) {
        // @ts-ignore
        pros.push(ad.post(item.msg, item.param))
      }
      await Promise.all(pros)
    }
  }
}

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
