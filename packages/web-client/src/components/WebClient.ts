import type { Card, Upgrade } from '@sctavern-emulator/data'
import {
  type $SlaveGame,
  PlayerClient,
  type InnerMsg,
} from '@sctavern-emulator/emulator'
import type { ClientStatus } from './types'
import {
  Signal,
  type ClientConnection,
  type IWebSocket,
  type IWebSocketFactory,
} from '@nekosu/game-framework'

export class WebClient extends PlayerClient {
  status: ClientStatus

  constructor(game: $SlaveGame, pos: number, status: ClientStatus) {
    super(game, pos)
    this.status = status
  }

  async selected(choice: string) {
    this.status.selected = choice
  }

  async begin_insert() {
    this.status.insert = true
    this.status.model = true
  }

  async end_insert() {
    this.status.insert = false
    this.status.model = false
  }

  async begin_deploy() {
    this.status.deploy = true
    this.status.model = true
  }

  async end_deploy() {
    this.status.deploy = false
    this.status.model = false
  }

  async begin_discover(item: (Card | Upgrade | string)[], extra?: string) {
    this.status.discover = true
    this.status.discoverItems = item
    this.status.discoverExtra = extra || null
    this.status.model = true
  }

  async end_discover() {
    this.status.discover = false
    this.status.discoverItems = []
    this.status.discoverExtra = null
    this.status.model = false
  }
}

export const WebsockFactory: IWebSocketFactory = {
  serverFactory: () => null,
  clientFactory: url => {
    const sock = new WebSocket(url)
    const s: IWebSocket = {
      send: new Signal(),
      recv: new Signal(),
      status: new Signal(),
      ctrl: new Signal(),
    }
    sock.onopen = () => {
      s.status.emit('open')
    }
    sock.onclose = () => {
      s.status.emit('close')
    }
    sock.onmessage = ({ data }) => {
      s.recv.emit(data)
    }
    s.send.connect(async item => {
      sock.send(item)
    })
    s.ctrl.connect(async req => {
      switch (req) {
        case 'close':
          sock.close()
          break
      }
    })
    return s
  },
}
