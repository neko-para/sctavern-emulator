import type { Card, Upgrade } from '@sctavern-emulator/data'
import {
  type $SlaveGame,
  PlayerClient,
  type InnerMsg,
} from '@sctavern-emulator/emulator'
import type { ClientStatus } from './types'
import type { ClientConnection } from '@nekosu/game-framework'

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

export async function WebsockConnect(
  conns: ClientConnection<InnerMsg>,
  url: string,
  init: () => void = () => {}
) {
  const sock = new WebSocket(url)
  sock.addEventListener('open', () => {
    init()
  })
  sock.addEventListener('message', ({ data }) => {
    conns.signal.emit(JSON.parse(data) as InnerMsg)
  })
  conns.slot.bind(async item => {
    sock.send(JSON.stringify(item))
  })
}
