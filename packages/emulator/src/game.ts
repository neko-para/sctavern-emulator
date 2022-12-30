import { reactive } from '@vue/reactivity'
import { DispatchTranslator, MsgKeyOf } from './dispatcher'
import { InnerMsg, InputMsg, OutterMsg } from './events'
import { Player, PlayerAttrib } from './player'
import { Pool } from './pool'
import { GameConfig } from './types'
import { Shuffler } from './utils'
import { Game, SlaveGame } from '@nekosu/game-framework'
import { Broadcast, Signal } from '@nekosu/game-framework/signal'

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
  mainBroadcast: Broadcast<InnerMsg>
  clientSignal: Signal<OutterMsg>

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
    this.mainBroadcast = new Broadcast()
    this.clientSignal = new Signal()

    this.mainBroadcast.bind(async (msg: InnerMsg) => {
      console.log(msg)
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
    await this.mainBroadcast.emit({
      msg: 'round-start',
      round: 1,
    })
    await this.mainBroadcast.emit({
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
    await this.mainBroadcast.emit({
      msg: 'round-end',
      round: this.data.round,
    })
    await this.mainBroadcast.emit({
      msg: 'round-leave',
      round: this.data.round,
    })
    this.data.round += 1
    this.data.done_count = 0
    await this.mainBroadcast.emit({
      msg: 'round-start',
      round: this.data.round,
    })
    await this.mainBroadcast.emit({
      msg: 'round-enter',
      round: this.data.round,
    })
  }
}
