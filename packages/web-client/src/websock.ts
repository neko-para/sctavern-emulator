import { Signal } from '@sctavern-emulator/framework'
import type {
  IWebSocketClientFactory,
  IWebSocket,
} from '@sctavern-emulator/framework'

function wrapSocket(socket: WebSocket) {
  const s: IWebSocket = {
    recv: new Signal(),
    send: new Signal(),
    status: new Signal(),
    ctrl: new Signal(),
  }
  socket.onopen = () => {
    s.status.emit('open')
  }
  socket.onclose = () => {
    s.status.emit('close')
  }
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
  socket.onmessage = ({ data }) => {
    s.recv.emit(data)
  }
  return s
}

export const clientFactory: IWebSocketClientFactory = url => {
  return wrapSocket(new WebSocket(url))
}
