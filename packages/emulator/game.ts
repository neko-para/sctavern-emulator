import { Emitter } from './emitter'
import { Player } from './player'
import { Pool } from './pool'
import { LogicBus, OutputBus } from './types'
import { Shuffler } from './utils'

const PlayerCount = 1

interface GameAttrib {
  round: number
}

export class Game {
  bus: Emitter<LogicBus>
  obus: Emitter<OutputBus>

  data: GameAttrib

  gen: Shuffler
  pool: Pool
  player: Player[]

  constructor(pack: Record<string, boolean> = { 核心: true }, gen: Shuffler) {
    this.player = Array(PlayerCount)
      .fill(null)
      .map((_, i) => {
        return new Player(this, i)
      })

    this.bus = new Emitter(
      'player',
      this.player.map(p => p.bus)
    )
    this.obus = new Emitter('client', Array(PlayerCount).fill(null))

    this.data = {
      round: 0,
    }

    this.gen = gen
    this.pool = new Pool(pack, this.gen)
  }

  async post<T extends string & keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.bus.emit(msg, param)
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

  async next_round() {
    await this.post('round-end', {
      round: this.data.round,
    })
    this.data.round += 1
    await this.post('round-start', {
      round: this.data.round,
    })
  }
}
