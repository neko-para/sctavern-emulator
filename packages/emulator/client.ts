import { Card, CardKey, UpgradeKey } from 'data'
import { Emitter } from './emitter'
import { Game, GameReplay, LogItem } from './game'
import { Player } from './player'
import { LogicBus, OutputBus } from './types'

interface ClientRespond {
  pos: number

  refresh(): Promise<void>
  selected(choice: string): Promise<void>
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
    bus.on('selected', ({ choice }) => client.selected(choice))
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
    while (this.peekNextReplayItem()?.msg === '$select') {
      await this.postItem(this.nextReplayItem())
    }
    if (this.peekNextReplayItem()?.msg === '$discover-choice') {
      await this.step()
      await this.postItem(this.nextReplayItem())
    }
  }

  async replay_insert() {
    while (this.peekNextReplayItem()?.msg === '$select') {
      await this.postItem(this.nextReplayItem())
    }
    if (this.peekNextReplayItem()?.msg === '$insert-choice') {
      await this.step()
      await this.postItem(this.nextReplayItem())
    }
  }

  async refresh() {}

  async selected(choice: string) {}

  async begin_discover(item: (Card | UpgradeKey)[], cancel: boolean) {}

  async end_discover() {}

  async begin_insert() {}

  async end_insert() {}

  async begin_select() {}

  async end_select() {}

  async replay(
    replay: GameReplay,
    step: () => Promise<boolean> = async () => false
  ) {
    this.replayLog = replay.log
    console.log(replay)
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

  async requestHand({
    pos,
    act,
  }: {
    pos: number
    act: 'enter' | 'combine' | 'sell'
  }) {
    switch (act) {
      case 'enter':
        await this.post('$hand-enter', {
          place: pos,
          player: this.pos,
        })
        break
      case 'combine':
        await this.post('$hand-combine', {
          place: pos,
          player: this.pos,
        })
        break
      case 'sell':
        await this.post('$hand-sell', {
          place: pos,
          player: this.pos,
        })
        break
    }
  }

  async requestStore({
    pos,
    act,
  }: {
    pos: number
    act: 'enter' | 'combine' | 'cache'
  }) {
    switch (act) {
      case 'enter':
        await this.post('$buy-enter', {
          place: pos,
          player: this.pos,
        })
        break
      case 'combine':
        await this.post('$buy-combine', {
          place: pos,
          player: this.pos,
        })
        break
      case 'cache':
        await this.post('$buy-cache', {
          place: pos,
          player: this.pos,
        })
        break
    }
  }

  async requestPresent({ pos, act }: { pos: number; act: 'upgrade' | 'sell' }) {
    switch (act) {
      case 'upgrade':
        await this.post('$present-upgrade', {
          place: pos,
          player: this.pos,
        })
        break
      case 'sell':
        await this.post('$present-sell', {
          place: pos,
          player: this.pos,
        })
        break
    }
  }

  async requestUpgrade() {
    await this.post('$upgrade', {
      player: this.pos,
    })
  }

  async requestRefresh() {
    await this.post('$refresh', {
      player: this.pos,
    })
  }

  async requestUnlock() {
    await this.post('$unlock', {
      player: this.pos,
    })
  }

  async requestLock() {
    await this.post('$lock', {
      player: this.pos,
    })
  }

  async requestNext() {
    await this.post('$done', {
      player: this.pos,
    })
  }

  async requestAbility() {
    await this.post('$ability', {
      player: this.pos,
    })
  }

  async insertChoose({ pos }: { pos: number }) {
    await this.post('$insert-choice', {
      choice: pos,
      player: this.pos,
    })
  }

  async discoverChoose({ pos }: { pos: number }) {
    await this.post('$discover-choice', {
      choice: pos,
      player: this.pos,
    })
  }

  async selectChoose(s: string) {
    await this.post('$select', {
      choice: s,
      player: this.pos,
    })
  }

  async requestObtainCard(card: CardKey) {
    await this.post('$obtain-card', {
      card,
      player: this.pos,
    })
  }

  async requestResource() {
    await this.post('$imr', {
      player: this.pos,
    })
  }
}
