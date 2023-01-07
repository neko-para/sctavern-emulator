import { WebSocket, WebSocketServer } from 'ws'
import { Signal } from '../src'
import type {
  IWebSocketClientFactory,
  IWebSocketServerFactory,
  IWebSocket
} from '../src'

function wrapSocket(socket: WebSocket) {
  const s: IWebSocket = {
    recv: new Signal(),
    send: new Signal(),
    status: new Signal(),
    ctrl: new Signal()
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
        s.ctrl.disconnect(null)
        break
    }
  })
  s.send.connect(async item => {
    socket.send(item)
  })
  socket.on('message', data => {
    s.recv.emit(data.toString())
  })
  return s
}

export const clientFactory: IWebSocketClientFactory = url => {
  return wrapSocket(new WebSocket(url))
}

export const serverFactory: IWebSocketServerFactory = port => {
  const srv = {
    server: new WebSocketServer({
      port
    }),
    status: new Signal<'listening' | 'close'>(),
    ctrl: new Signal<'close'>(),
    connected: new Signal<IWebSocket>()
  }
  srv.server.on('listening', () => {
    srv.status.emit('listening')
  })
  srv.server.on('close', () => {
    srv.status.emit('close')
  })
  srv.ctrl.connect(async item => {
    switch (item) {
      case 'close':
        srv.server.close()
        srv.ctrl.disconnect(null)
        break
    }
  })
  srv.server.on('connection', socket => {
    srv.connected.emit(wrapSocket(socket))
  })
  return srv
}
