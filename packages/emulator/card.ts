import {
  Card,
  CardKey,
  getUnit,
  Race,
  Unit,
  UnitKey,
  UpgradeKey,
  Upgrades,
} from 'data'
import { describe } from 'node:test'
import { AttributeManager } from './attribute'
import { Emitter } from './emitter'
import { Player } from './player'
import {
  LogicBus,
  Descriptor,
  DescriptorGenerator,
  ObtainUnitWay,
} from './types'
import { refC, refP } from './utils'

export interface CardInstanceAttrib {
  name: string
  race: Race
  level: number

  color: 'normal' | 'gold' | 'darkgold'

  units: UnitKey[]
  upgrades: UpgradeKey[]

  belong: 'none' | 'origin' | 'void'

  descs: Descriptor[]
  attrib: AttributeManager
}

export class CardInstance {
  bus: Emitter<LogicBus>
  pos: number
  player: Player

  data: CardInstanceAttrib

  occupy: CardKey[]

  constructor(player: Player, cardt: Card) {
    this.bus = new Emitter('', [])
    this.pos = -1
    this.player = player

    this.data = {
      name: cardt.name,
      race: cardt.race,
      level: cardt.level,
      color: cardt.attr.gold ? 'darkgold' : 'normal',
      units: [],
      upgrades: [],
      belong: 'none',
      descs: [],
      attrib: new AttributeManager(async () => {
        await this.player.refresh()
      }),
    }

    if (cardt.attr.origin) {
      this.data.belong = 'origin'
    } else if (cardt.attr.void) {
      this.data.belong = 'void'
    }

    this.occupy = [cardt.name]

    this.bind()
  }

  async post<T extends string & keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.player.game.post(msg, param)
  }

  left(): CardInstance | null {
    if (this.pos > 0 && this.player.present[this.pos - 1]) {
      return this.player.present[this.pos - 1]
    } else {
      return null
    }
  }

  right(): CardInstance | null {
    if (this.pos < 6 && this.player.present[this.pos + 1]) {
      return this.player.present[this.pos + 1]
    } else {
      return null
    }
  }

  value() {
    return this.data.units
      .map(getUnit)
      .map(u => u.value)
      .reduce((p, c) => p + c, 0)
  }

  private self_power(): number {
    return this.find('水晶塔').length + this.find('虚空水晶塔').length
  }

  power(): number {
    return (
      this.self_power() +
      (this.left()?.self_power() || 0) +
      (this.right()?.self_power() || 0)
    )
  }

  attribs(): string[] {
    const result: string[] = Object.keys(this.data.attrib.attrib)
      .map(a => this.data.attrib.attrib[a])
      .map(a => a.show(a.value))
      .filter(a => a)
    if (this.data.race === 'P' || this.power() > 0) {
      result.push(`能量强度: ${this.power()}`)
    }
    return result
  }

  infr(): ['reactor' | 'scilab' | 'hightech' | 'none', number] {
    let idx = -1
    idx = this.data.units.indexOf('反应堆')
    if (idx !== -1) {
      return ['reactor', idx]
    }
    idx = this.data.units.indexOf('科技实验室')
    if (idx !== -1) {
      return ['scilab', idx]
    }
    idx = this.data.units.indexOf('高级科技实验室')
    if (idx !== -1) {
      return ['hightech', idx]
    }
    return ['none', -1]
  }

  async switch_infr() {
    if (this.data.race !== 'T') {
      return
    }
    const [type, pos] = this.infr()
    switch (type) {
      case 'reactor':
        this.replace_unit([pos], '科技实验室')
        break
      case 'scilab':
        await this.replace_unit([pos], '反应堆')
        break
      default:
        return
    }
    await this.post('infr-changed', refC(this))
    await this.fast_prod()
  }

  async upgrade_infr() {
    if (this.data.race !== 'T') {
      return
    }
    const [type, pos] = this.infr()
    switch (type) {
      case 'reactor':
      case 'scilab':
        this.replace_unit([pos], '高级科技实验室')
        await this.post('infr-changed', refC(this))
        await this.fast_prod()
        break
    }
  }

  async fast_prod() {
    await this.player.game.post('fast-prod', refC(this))
    await this.player.refresh()
  }

  async obtain_unit(units: UnitKey[], way: ObtainUnitWay = 'normal') {
    await this.post('obtain-unit-prev', {
      ...refC(this),
      units,
      way,
    })
    this.data.units = this.data.units
      .concat(units)
      .slice(0, this.player.config.MaxUnitPerCard)
    await this.post('obtain-unit-post', {
      ...refC(this),
      units,
      way,
    })
    await this.player.refresh()
  }

  async obtain_upgrade(upgrade: UpgradeKey) {
    if (this.data.upgrades.length < this.player.config.MaxUpgradePerCard) {
      this.data.upgrades.push(upgrade)
      // TODO: Apply upgrade effect
      await this.player.refresh()
    }
  }

  async replace_unit(
    places: number[],
    unit: UnitKey | ((u: UnitKey) => UnitKey)
  ) {
    const proc = typeof unit === 'string' ? () => unit : unit
    places.forEach(idx => {
      if (idx >= 0 && idx < this.data.units.length) {
        this.data.units[idx] = proc(this.data.units[idx])
      }
    })
    await this.player.refresh()
  }

  async filter(func: (unit: UnitKey, pos: number) => boolean) {
    const taked: UnitKey[] = []
    this.data.units = this.data.units.filter((u, i) => {
      if (func(u, i)) {
        taked.push(u)
        return false
      } else {
        return true
      }
    })
    await this.player.refresh()
    return taked
  }

  async add_desc(desc: DescriptorGenerator, text: [string, string]) {
    const d = desc(this, this.data.color !== 'normal', text)
    this.data.descs.push(d)
    if (d.unique) {
      await this.player.add_unique(this, d)
    } else {
      await this.player.refresh()
    }
  }

  async clear_desc() {
    for (const d of this.data.descs) {
      d.unbind()
      if (d.unique) {
        await this.player.del_unique(d)
      }
    }
    this.data.descs = []
    await this.player.refresh()
  }

  async seize(
    target: CardInstance,
    option: {
      unreal?: boolean
      upgrade?: boolean // 是否夺取升级
    }
  ) {
    await this.obtain_unit(target.data.units)
    if (option.upgrade) {
      for (const u of this.data.upgrades) {
        await this.obtain_upgrade(u)
      }
    }
    if (!option.unreal) {
      await this.post('seize', {
        ...refC(this),
        target,
      })
    }
  }

  async regroup(id: number = 0) {
    await this.post('regroup', {
      ...refC(this),
      id,
    })
  }

  async gain_darkness(dark: number) {
    this.data.attrib.setAttribute(
      'dark',
      (this.data.attrib.getAttribute('dark') || 0) + dark
    )
    if (dark > 0) {
      await this.post('gain-darkness', {
        ...refC(this),
        dark,
      })
    }
  }

  find(u: UnitKey | ((unit: UnitKey) => boolean), maxi?: number) {
    const pred = typeof u === 'string' ? (unit: UnitKey) => unit === u : u
    return this.data.units
      .filter(pred)
      .map((u, i) => i)
      .slice(0, maxi)
  }

  bind() {
    this.bus.on('round-end', async () => {
      // 高科的快产
      if (this.data.race === 'T' && this.infr()[0] === 'hightech') {
        await this.player.game.post('fast-prod', refC(this))
      }
    })
    this.bus.on('post-sell', async () => {
      const n = this.find('虚空水晶塔').length
      if (n > 0) {
        for (const c of [this.left(), this.right()]) {
          if (c?.data.race === 'P') {
            this.obtain_unit(Array<UnitKey>(n).fill('虚空水晶塔'))
            break
          }
        }
      }
    })
  }
}
