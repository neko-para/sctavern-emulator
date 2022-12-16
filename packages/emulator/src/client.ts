import { Card, CardKey, UnitKey, Upgrade } from '@sctavern-emulator/data'
import { Emitter } from './emitter'
import { Game } from './game'
import { Player } from './player'
import {
  GameConfig,
  GameReplay,
  InputBus,
  LogicBus,
  LogItem,
  OutputBus,
} from './types'
import { postItem } from './utils'

interface IClient {
  pos: number

  selected(choice: string): Promise<void>
  begin_discover(
    item: (Card | Upgrade | string)[],
    extra?: string
  ): Promise<void>
  end_discover(): Promise<void>
  begin_deploy(): Promise<void>
  end_deploy(): Promise<void>
  begin_insert(): Promise<void>
  end_insert(): Promise<void>
}

class LogQueue {
  items: LogItem[]
  resolve: ((item: LogItem) => void)[]

  constructor() {
    this.items = []
    this.resolve = []
  }

  push(item: LogItem) {
    const r = this.resolve.shift()
    if (r) {
      setTimeout(() => {
        r(item)
      }, 0)
    } else {
      this.items.push(item)
    }
  }

  async pop(): Promise<LogItem> {
    if (this.items.length > 0) {
      return this.items.shift() as LogItem
    } else {
      return new Promise<LogItem>(resolve => {
        this.resolve.push(resolve)
      })
    }
  }
}

export interface Adapter {
  onPosted: (item: LogItem) => void

  post<T extends keyof InputBus>(msg: T, param: InputBus[T]): Promise<void>
}

export class SlaveGame {
  game: Game
  adapter: Adapter
  queue: LogQueue
  loop: SlaveEventLoop

  constructor(config: GameConfig, adapter: Adapter) {
    this.game = new Game(config, this)
    this.adapter = adapter
    this.queue = new LogQueue()
    this.loop = new SlaveEventLoop(this)

    this.adapter.onPosted = item => {
      this.queue.push(item)
    }
  }

  async poll(quit: () => boolean = () => false) {
    await this.loop.exec(quit)
  }

  bind(client: IClient): void {
    const bus = new Emitter<OutputBus>('', [])
    this.game.obus.child[client.pos] = bus

    bus.on('selected', ({ choice }) => client.selected(choice))
    bus.on('begin-discover', ({ item, extra }) =>
      client.begin_discover(item, extra)
    )
    bus.on('end-discover', () => client.end_discover())
    bus.on('begin-deploy', () => client.begin_deploy())
    bus.on('end-deploy', () => client.end_deploy())
    bus.on('begin-insert', () => client.begin_insert())
    bus.on('end-insert', () => client.end_insert())
  }

  async post<T extends keyof InputBus>(msg: T, param: LogicBus[T]) {
    await this.adapter.post(msg, param)
  }
}

class SlaveEventLoop {
  game: SlaveGame

  constructor(game: SlaveGame) {
    this.game = game
  }

  async exec(quit: () => boolean) {
    while (!quit()) {
      const item = await this.game.queue.pop()
      // console.log('poll', item.msg)
      await postItem(this.game.game, item)
    }
  }
}

export class MasterGame {
  adapter: Adapter[]
  queue: LogQueue

  constructor(adapter: Adapter[]) {
    this.adapter = adapter
    this.queue = new LogQueue()

    this.adapter.forEach(ad => {
      ad.onPosted = item => {
        this.queue.push(item)
      }
    })
  }

  async poll() {
    for (;;) {
      const item = await this.queue.pop()
      const pros: Promise<void>[] = []
      for (const ad of this.adapter) {
        pros.push(postItem(ad, item))
      }
      await Promise.all(pros)
    }
  }
}

class LocalLinkAdapter implements Adapter {
  onPosted: (item: LogItem) => void
  to: LocalLinkAdapter | null

  constructor() {
    this.onPosted = () => {
      //
    }
    this.to = null
  }

  async post<T extends keyof InputBus>(msg: T, param: InputBus[T]) {
    this.to?.onPosted({
      msg,
      param,
    })
  }

  bind(to: LocalLinkAdapter) {
    this.to = to
  }
}

export class LocalGame {
  master: MasterGame
  slave: SlaveGame

  constructor(config: GameConfig) {
    const ml = new LocalLinkAdapter()
    const sl = new LocalLinkAdapter()
    ml.bind(sl)
    sl.bind(ml)
    this.master = new MasterGame([ml])
    this.slave = new SlaveGame(config, sl)
  }
}

export class Client implements IClient {
  game: SlaveGame
  pos: number
  player: Player
  step: () => Promise<void>
  stop: boolean

  constructor(game: SlaveGame, pos: number) {
    this.game = game
    this.pos = pos
    this.player = game.game.player[pos]

    this.step = async () => {
      //
    }
    this.stop = false

    game.bind(this)
  }

  async post<T extends keyof InputBus>(msg: T, param: LogicBus[T]) {
    await this.game.post(msg, param)
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
      await postItem(this, item)
      await this.step()
    }
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

  async deployChoose({ pos }: { pos: number }) {
    await this.post('$deploy-choice', {
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

  async requestObtainUnit(place: number, units: UnitKey[]) {
    await this.post('$obtain-unit', {
      place,
      units,
      player: this.pos,
    })
  }

  async requestResource() {
    await this.post('$imr', {
      player: this.pos,
    })
  }
}
