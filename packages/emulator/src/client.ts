import {
  Client,
  MasterGame,
  Signal,
  SlaveGame,
} from '@sctavern-emulator/framework'
import { Card, Upgrade } from '@sctavern-emulator/data'
import { InnerMsg, OutterMsg } from './events'
import { GameInstance } from './game'
import { Player } from './player'
import { DistributiveOmit, GameReplay, LogItem } from './types'

export type $MasterGame = MasterGame<InnerMsg>
export type $SlaveGame = SlaveGame<InnerMsg, OutterMsg, GameInstance>
export type $Client = Client<InnerMsg, OutterMsg, GameInstance>

export class PlayerClient implements $Client {
  slave: $SlaveGame
  $send: Signal<InnerMsg>
  $recv: Signal<OutterMsg>

  pos: number
  player: Player
  step: () => Promise<void>
  stop: boolean

  constructor(slave: $SlaveGame, pos: number) {
    this.slave = slave
    this.$send = new Signal()
    this.$recv = new Signal()

    this.pos = pos
    this.player = this.slave.game.player[pos]

    this.step = async () => {
      //
    }
    this.stop = false

    this.$recv.connect(async item => {
      if (item.client !== this.pos) {
        return
      }
      switch (item.msg) {
        case 'selected':
          switch (item.area) {
            case 'none':
              await this.selected('none')
              break
            case 'hand':
              await this.selected(`H${item.choice}`)
              break
            case 'store':
              await this.selected(`S${item.choice}`)
              break
            case 'present':
              await this.selected(`P${item.choice}`)
              break
          }
          break
        case 'insert':
          switch (item.time) {
            case 'begin':
              await this.begin_insert()
              break
            case 'end':
              await this.end_insert()
              break
          }
          break
        case 'discover':
          switch (item.time) {
            case 'begin':
              await this.begin_discover(item.item, item.extra)
              break
            case 'end':
              await this.end_discover()
              break
          }
          break
        case 'deploy':
          switch (item.time) {
            case 'begin':
              await this.begin_deploy()
              break
            case 'end':
              await this.end_deploy()
              break
          }
          break
      }
    })
  }

  async post<
    T extends DistributiveOmit<Extract<InnerMsg, { player: number }>, 'player'>
  >(msg: T): Promise<T & { player: number }> {
    const rm = {
      player: this.pos,
      ...msg,
    }
    await this.$send.emit(rm)
    return rm
  }

  async selected(choice: string) {
    //
  }

  async begin_discover(item: (Card | Upgrade | string)[], extra?: string) {
    //
  }

  async end_discover() {
    //
  }

  async begin_deploy() {
    //
  }

  async end_deploy() {
    //
  }

  async begin_insert() {
    //
  }

  async end_insert() {
    //
  }

  async replay(
    replay: GameReplay,
    step: () => Promise<boolean> = async () => false
  ) {
    this.step = async () => {
      this.stop = this.stop || (await step())
    }
    this.stop = false
    const log = replay.log.map(x => x)
    while (log.length > 0 && !this.stop) {
      const item = log.shift() as LogItem
      await this.post(item)
      await this.step()
    }
  }
}
