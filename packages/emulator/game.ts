import { RoleKey } from 'data'
import { Emitter } from './emitter'
import { Player } from './player'
import { Pool } from './pool'
import { GameConfig, InputBus, LogicBus, OutputBus } from './types'
import { Shuffler } from './utils'

interface GameAttrib {
  round: number
  done_count: number
}

export interface LogItem {
  msg: string
  param: {}
}

export interface GameReplay {
  pack: string[]
  seed: string
  role: RoleKey
  log: LogItem[]
}

export class Game {
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

    this.data = {
      round: 0,
      done_count: 0,
    }

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

  async postInput<T extends keyof InputBus>(msg: T, param: LogicBus[T]) {
    this.log.push({
      msg,
      param,
    })
    await this.post(msg, param)
  }

  async postOutput<T extends string & keyof OutputBus>(
    msg: T,
    param: OutputBus[T]
  ) {
    await this.obus.emit(msg, param)
  }

  async start() {
    this.data.round = 1
    await this.post('round-start', {
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
  }
}
