import { CardKey, UnitKey, UpgradeKey } from 'data'
import { CardInstance } from './card'
import { Emitter } from './emitter'
import { Game } from './game'
import { LogicBus, PlayerConfig } from './types'
import { isCardInstance, isNotCardInstance, refP, Shuffler } from './utils'

interface PlayerAttrib {
  level: number
  upgrade_cost: number

  mineral: number
  gas: number
}

export class Player {
  bus: Emitter<LogicBus>
  game: Game
  pos: number

  data: PlayerAttrib

  store: (CardKey | null)[]
  hand: (CardKey | null)[]
  present: (CardInstance | null)[]

  config: PlayerConfig

  constructor(game: Game, pos: number) {
    this.bus = new Emitter('card', [])
    this.game = game
    this.pos = pos
    this.data = {
      level: 1,
      upgrade_cost: 6,
      mineral: 0,
      gas: -1,
    }

    this.store = Array(3).fill(null)
    this.hand = Array(6).fill(null)
    this.present = Array(7).fill(null)

    this.config = {
      MaxUnitPerCard: 200,
      MaxUpgradePerCard: 5,
    }
  }

  async post<T extends string & keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.game.post(msg, param)
  }

  async refresh() {
    await this.game.postOutput('refresh', {
      client: this.pos,
    })
  }

  find_name(name: CardKey) {
    return this.present
      .filter(isCardInstance)
      .filter(card => card.data.name === name)
  }

  first_hole(): number {
    const place = this.present.filter(isNotCardInstance).map((c, i) => i)
    return place.length > 0 ? place[0] : -1
  }

  async discover(
    item: (CardKey | UpgradeKey)[],
    option?: {
      target?: CardInstance
      cancel?: boolean
    }
  ) {
    // TODO: Implement
  }

  async obtain_resource(resource: { mineral?: number; gas?: number }) {
    this.data.mineral += resource.mineral || 0
    this.data.gas += resource.gas || 0
    await this.refresh()
  }

  async incubate(from: CardInstance, units: UnitKey[]) {
    await this.post('incubate', {
      ...refP(this),
      from,
      units,
    })
    for (const c of [from.left(), from.right()]) {
      if (c?.data.race === 'Z') {
        await c.obtain_unit(units, 'incubate')
      }
    }
  }

  async inject(from: CardInstance | null, units: UnitKey[]) {
    const eggs = this.find_name('虫卵')
    let egg_card: CardInstance | null = null
    if (eggs.length === 0) {
      const hole = this.first_hole()
      if (hole === -1) {
        return
      }
      // TODO: Implement
      // egg_card = xxx
    } else {
      egg_card = eggs[0]
    }
    if (egg_card) {
      await egg_card.obtain_unit(units)
      await this.post('inject', {
        ...refP(this),
        from,
        units,
      })
    }
  }

  async wrap(units: UnitKey[]) {
    const param = {
      ...refP(this),
      units,
      into: null,
    }
    await this.post('wrap', param)
    if (param.into === null) {
      const targets = this.present
        .filter(isCardInstance)
        .filter(x => x.data.race === 'P') as CardInstance[]
      if (!targets.length) {
        return
      }
      this.game.gen.shuffle(targets)
      targets[0].obtain_unit(units, 'wrap')
    }
  }
}
