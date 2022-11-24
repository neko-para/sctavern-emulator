import { Card, UpgradeKey } from 'data'
import { Emitter } from './emitter'
import { Game, GameReplay, LogItem } from './game'
import { Player } from './player'
import { LogicBus, OutputBus } from './types'

interface ClientRespond {
  pos: number

  refresh(): Promise<void>
  begin_discover(item: (Card | UpgradeKey)[], cancel: boolean): Promise<void>
  end_discover(): Promise<void>
  begin_insert(): Promise<void>
  end_insert(): Promise<void>
}

interface GameWrapperBase {
  game: Game

  bind(client: ClientRespond): void
  post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]): Promise<void>
}

export class LocalGame implements GameWrapperBase {
  game: Game

  constructor(game: Game) {
    this.game = game
  }

  bind(client: ClientRespond): void {
    const bus = new Emitter<OutputBus>('', [])
    this.game.obus.child[client.pos] = bus

    bus.on('refresh', () => client.refresh())
    bus.on('begin-discover', ({ item, cancel }) =>
      client.begin_discover(item, cancel)
    )
    bus.on('end-discover', () => client.end_discover())
    bus.on('begin-insert', () => client.begin_insert())
    bus.on('end-insert', () => client.end_insert())
  }

  async post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.game.post(msg, param)
  }
}

export class Client implements ClientRespond {
  pos: number
  player: Player
  wrapper: GameWrapperBase
  replayLog: LogItem[]
  replayPos: number
  step: () => Promise<void>
  stop: boolean

  constructor(wrapper: GameWrapperBase, pos: number) {
    this.pos = pos
    this.player = wrapper.game.player[pos]
    this.wrapper = wrapper

    this.replayLog = []
    this.replayPos = 0

    this.step = async () => {}
    this.stop = false

    wrapper.bind(this)
  }

  async post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.wrapper.post(msg, param)
  }

  peekNextReplayItem(): LogItem | null {
    return this.replayPos < this.replayLog.length
      ? this.replayLog[this.replayPos]
      : null
  }

  nextReplayItem(): LogItem {
    return this.replayLog[this.replayPos++]
  }

  async replay_discover() {
    if (this.peekNextReplayItem()?.msg === '$discover-choice') {
      await this.step()
      await this.postItem(this.nextReplayItem())
    }
  }

  async replay_insert() {
    if (this.peekNextReplayItem()?.msg === '$insert-choice') {
      await this.step()
      await this.postItem(this.nextReplayItem())
    }
  }

  async refresh() {}

  async begin_discover(item: (Card | UpgradeKey)[], cancel: boolean) {}

  async end_discover() {}

  async begin_insert() {}

  async end_insert() {}

  async replay(
    replay: GameReplay,
    step: () => Promise<boolean> = async () => false
  ) {
    this.replayLog = replay.log
    this.replayPos = 0
    this.step = async () => {
      this.stop = await step()
    }
    this.stop = false
    while (this.replayPos < this.replayLog.length && !this.stop) {
      const item = this.replayLog[this.replayPos++]
      await this.postItem(item)
      if (this.stop) {
        break
      }
      await this.step()
    }
  }

  async postItem(item: LogItem) {
    // @ts-ignore
    await this.post(item.msg, item.param)
  }
}
