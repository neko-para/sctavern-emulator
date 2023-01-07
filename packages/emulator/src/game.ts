import { reactive } from '@vue/reactivity'
import { DispatchTranslator, MsgKeyOf } from './dispatcher'
import { InnerMsg, InputMsg, OutterMsg } from './events'
import { Player, PlayerAttrib } from './player'
import { Pool } from './pool'
import { GameConfig } from './types'
import { Shuffler } from './utils'
import { Game, SlaveGame, Signal } from '@sctavern-emulator/framework'

interface GameAttrib {
  round: number
  done_count: number

  player: (PlayerAttrib | null)[]
}

export class GameInstance
  extends DispatchTranslator<MsgKeyOf<InnerMsg>, InnerMsg>
  implements Game<InnerMsg, OutterMsg>
{
  slave: SlaveGame<InnerMsg, OutterMsg, GameInstance>
  $game: Signal<InnerMsg>
  $client: Signal<OutterMsg>

  config: GameConfig

  data: GameAttrib

  gen: Shuffler
  pool: Pool
  player: Player[]

  log: InputMsg[]

  constructor(
    config: GameConfig,
    slave: SlaveGame<InnerMsg, OutterMsg, GameInstance>
  ) {
    super(msg => {
      if ('player' in msg) {
        return [this.player[msg.player]]
      } else {
        return this.player
      }
    })

    this.slave = slave
    this.$game = new Signal()
    this.$client = new Signal()

    this.$game.connect(async (msg: InnerMsg) => {
      11
      if (msg.msg[0] === '$') {
        this.log.push(msg as InputMsg)
      }
      await this.$emit(msg)
    })

    this.config = config
    const count = config.role.length
    this.player = Array(count)
      .fill(null)
      .map((_, i) => {
        return new Player(this, i, config.role[i])
      })

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

  async start() {
    this.data.round = 1
    await this.$game.emit({
      msg: 'round-start',
      round: 1,
    })
    await this.$game.emit({
      msg: 'round-enter',
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
    await this.$game.emit({
      msg: 'round-end',
      round: this.data.round,
    })
    await this.$game.emit({
      msg: 'round-leave',
      round: this.data.round,
    })
    this.data.round += 1
    this.data.done_count = 0
    await this.$game.emit({
      msg: 'round-start',
      round: this.data.round,
    })
    await this.$game.emit({
      msg: 'round-enter',
      round: this.data.round,
    })
  }
}
