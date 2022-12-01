import { reactive } from '@vue/reactivity'
import { Emitter } from './emitter'
import { Player, PlayerAttrib } from './player'
import { Pool } from './pool'
import { GameConfig, LogicBus, LogItem, OutputBus, Postable } from './types'
import { Shuffler } from './utils'

interface GameAttrib {
  round: number
  done_count: number

  player: (PlayerAttrib | null)[]
}

export class Game implements Postable<LogicBus> {
  bus: Emitter<LogicBus>
  obus: Emitter<OutputBus>

  data: GameAttrib

  gen: Shuffler
  pool: Pool
  player: Player[]

  log: LogItem[]

  constructor(config: GameConfig) {
    const count = config.role.length
    this.player = Array(count)
      .fill(null)
      .map((_, i) => {
        return new Player(this, i, config.role[i])
      })

    this.bus = new Emitter(
      'player',
      this.player.map(p => p.bus)
    )
    this.obus = new Emitter('client', Array(count).fill(null))

    this.data = reactive({
      round: 0,
      done_count: 0,

      player: this.player.map(p => p.data),
    })

    this.gen = new Shuffler(config.seed)

    const pk: Record<string, boolean> = { 核心: true }
    config.pack.forEach(p => {
      pk[p] = true
    })
    this.pool = new Pool(pk, this.gen)

    this.log = []
  }

  shuffle<T>(arr: T[]): T[] {
    return this.gen.shuffle(arr)
  }

  async post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]) {
    console.log(msg)
    if (msg[0] === '$') {
      this.log.push({
        msg,
        param,
      })
    }
    await this.bus.emit(msg, param)
  }

  async postOutput<T extends keyof OutputBus>(msg: T, param: OutputBus[T]) {
    await this.obus.emit(msg, param)
  }

  async start() {
    this.data.round = 1
    await this.post('round-start', {
      round: 1,
    })
    await this.post('round-enter', {
      round: 1,
    })
  }

  async add_done() {
    this.data.done_count += 1
    if (this.data.done_count === this.player.length) {
      await this.next_round()
    }
  }

  async next_round() {
    await this.post('round-end', {
      round: this.data.round,
    })
    this.data.round += 1
    this.data.done_count = 0
    await this.post('round-start', {
      round: this.data.round,
    })
    await this.post('round-enter', {
      round: this.data.round,
    })
  }
}
