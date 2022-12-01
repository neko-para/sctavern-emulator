import { reactive, computed } from '@vue/reactivity'
import {
  Card,
  CardKey,
  getCard,
  getUnit,
  getUpgrade,
  isNormal,
  Race,
  Unit,
  UnitKey,
  UpgradeKey,
} from '@sctavern-emulator/data'
import { AttributeManager } from './attribute'
import { Descriptors } from './descriptor'
import { Emitter } from './emitter'
import { Player } from './player'
import {
  LogicBus,
  Descriptor,
  DescriptorGenerator,
  ObtainUnitWay,
  DescriptorInfo,
} from './types'
import {
  autoBind,
  isCardInstance,
  isCardInstanceAttrib,
  refC,
  us,
} from './utils'

export interface CardInstanceAttrib {
  pos: number

  name: string
  race: Race
  level: number

  color: 'normal' | 'gold' | 'darkgold'

  units: UnitKey[]
  upgrades: UpgradeKey[]

  belong: 'none' | 'origin' | 'void'

  descriptors: DescriptorInfo[]

  occupy: CardKey[]

  attribs: string[]
  left: CardInstanceAttrib | null
  right: CardInstanceAttrib | null
  around: CardInstanceAttrib[]
  value: number
  self_power: number
  power: number
  infr: ['reactor' | 'scilab' | 'hightech' | 'none', number]
}

export class CardInstance {
  bus: Emitter<LogicBus>
  player: Player

  readonly data: CardInstanceAttrib

  attrib: AttributeManager

  constructor(player: Player, cardt: Card) {
    this.bus = new Emitter('', [])
    this.player = player

    this.data = reactive({
      pos: -1,
      name: cardt.name,
      race: cardt.race,
      level: cardt.level,
      color: cardt.attr.gold ? 'darkgold' : 'normal',
      units: [],
      upgrades: [],
      belong: 'none',
      descriptors: [],
      occupy: [],

      attribs: computed(() => {
        return this.attrib.views.value
      }),
      left: computed(() => {
        if (this.data.pos > 0 && this.player.data.present[this.data.pos - 1]) {
          return this.player.data.present[this.data.pos - 1] || null
        } else {
          return null
        }
      }),
      right: computed(() => {
        if (this.data.pos < 6 && this.player.data.present[this.data.pos + 1]) {
          return this.player.data.present[this.data.pos + 1] || null
        } else {
          return null
        }
      }),
      around: computed(() => {
        return [this.data.left, this.data.right].filter(isCardInstanceAttrib)
      }),
      value: computed(() => {
        return (
          this.data.units
            .map(getUnit)
            .map(u => u.value)
            .reduce((a, b) => a + b, 0) + this.attrib.get('献祭价值')
        )
      }),
      self_power: computed(() => {
        return (
          this.find('水晶塔').length +
          this.find('虚空水晶塔').length +
          this.attrib.get('供能')
        )
      }),
      power: computed(() => {
        return (
          this.data.self_power +
          this.data.around.map(c => c.self_power).reduce((a, b) => a + b, 0)
        )
      }),
      infr: computed<['reactor' | 'scilab' | 'hightech' | 'none', number]>(
        () => {
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
      ),
    })

    this.attrib = new AttributeManager()

    if (cardt.attr.origin) {
      this.data.belong = 'origin'
      this.attrib.setView('origin', () => {
        return '属于原始虫群'
      })
    } else if (cardt.attr.void) {
      this.data.belong = 'void'
      this.set_void()
    }

    this.attrib.setView('power', () => {
      const p = this.data.power
      if (this.data.race === 'P' || p > 0) {
        return `能量强度: ${p}`
      } else {
        return ''
      }
    })

    if (cardt.attr.dark) {
      this.attrib.config('dark', 0, 'add')
    }

    this.bind()
    this.bindDef()
  }

  bindDef() {
    this.attrib.setView('power', () => {
      if (this.data.race === 'P' || this.data.power > 0) {
        return `能量强度: ${this.data.power}`
      } else {
        return ''
      }
    })

    if (this.attrib.has('dark')) {
      this.attrib.setView('dark', () => `黑暗值: ${this.attrib.get('dark')}`)
    }
  }

  async post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.player.game.post(msg, param)
  }

  left(): CardInstance | null {
    if (this.data.pos > 0 && this.player.present[this.data.pos - 1]) {
      return this.player.present[this.data.pos - 1]
    } else {
      return null
    }
  }

  right(): CardInstance | null {
    if (this.data.pos < 6 && this.player.present[this.data.pos + 1]) {
      return this.player.present[this.data.pos + 1]
    } else {
      return null
    }
  }

  around(): CardInstance[] {
    return [this.left(), this.right()].filter(isCardInstance)
  }

  set_void() {
    this.attrib.config('void', 1, 'max')
    this.attrib.setView('void', () => '虚空投影')
  }

  async switch_infr() {
    if (this.data.race !== 'T') {
      return
    }
    const [type, pos] = this.data.infr
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
    const [type, pos] = this.data.infr
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
    await this.post('fast-prod', refC(this))
  }

  async obtain_unit(units: UnitKey[], way: ObtainUnitWay = 'normal') {
    const p = {
      ...refC(this),
      units,
      way,
    }
    await this.post('obtain-unit-prev', p)
    this.data.units = this.data.units
      .concat(p.units)
      .slice(0, this.player.data.config.MaxUnitPerCard)
    await this.post('obtain-unit-post', p)
  }

  async remove_unit(index: number[]) {
    return this.filter((u, i) => index.includes(i))
  }

  async obtain_upgrade(upgrade: UpgradeKey) {
    if (this.data.upgrades.length < this.player.data.config.MaxUpgradePerCard) {
      const u = getUpgrade(upgrade)
      if (!u.override && this.data.upgrades.includes(upgrade)) {
        return
      }
      this.data.upgrades.push(upgrade)
      switch (upgrade) {
        case '折跃援军':
          await this.obtain_unit([
            ...us('水晶塔', 2),
            ...us('狂热者', 2),
            ...us('激励者', 2),
          ])
          break
        case '修理无人机':
          await this.obtain_unit([
            ...us('修理无人机', this.player.data.level + 3),
          ])
          break
        case '黄金矿工': {
          await this.clear_desc()
          const descs = Descriptors.黄金矿工
          this.data.name = '黄金矿工'
          this.data.color = 'gold'
          if (descs) {
            for (let i = 0; i < descs.length; i++) {
              await this.add_desc(descs[i], getCard('黄金矿工').desc[i])
            }
          } else {
            console.log('WARN: Card Not Implement Yet')
          }
          break
        }
        case '献祭': {
          const vo = (unit: Unit) => {
            if (unit.name === '莎拉·凯瑞甘' || unit.name === '刀锋女王') {
              return 10000
            } else {
              return unit.value
            }
          }
          const [_, idx] = this.data.units
            .filter(isNormal)
            .map(getUnit)
            .map((u, i) => [vo(u), i] as [number, number])
            .sort(([ua, ia], [ub, ib]) => {
              if (ua === ub) {
                return ia - ib
              } else {
                return ub - ua
              }
            })
            .slice(0, 1)[0] // 总是应该有单位的吧

          const sum =
            this.data.units
              .filter((u, i) => idx !== i)
              .map(getUnit)
              .map(u => u.health + (u.shield || 0))
              .reduce((a, b) => a + b, 0) * 1.5

          const vsum = this.data.units
            .filter((u, i) => idx !== i)
            .map(getUnit)
            .map(u => u.value)
            .reduce((a, b) => a + b, 0)

          this.data.units = [this.data.units[idx]]
          this.attrib.config('献祭', sum)
          this.attrib.config('献祭价值', vsum)
          this.attrib.setView(
            '献祭',
            () => `献祭的生命值: ${this.attrib.get('献祭')}`
          )
          this.add_desc(
            autoBind('obtain-unit-prev', async (card, gold, param) => {
              card.attrib.set(
                '献祭',
                card.attrib.get('献祭') +
                  param.units
                    .map(getUnit)
                    .map(u => u.health + (u.shield || 0))
                    .reduce((a, b) => a + b, 0) *
                    1.5
              )
              card.attrib.set(
                '献祭价值',
                card.attrib.get('献祭价值') +
                  param.units
                    .map(getUnit)
                    .map(u => u.value)
                    .reduce((a, b) => a + b, 0)
              )
              param.units = []
            }),
            ['新添加的单位也会被献祭', '新添加的单位也会被献祭']
          )
        }
      }
      await this.post('obtain-upgrade', {
        ...refC(this),
        upgrade,
      })
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

    return taked
  }

  async bind_desc(binder: (card: CardInstance) => Descriptor, text: string) {
    const d = binder(this)
    this.data.descriptors.push({
      text,
      desc: d,
      bind: binder,
    })
    if (d.unique) {
      await this.player.add_unique(this, d)
    }
  }

  async add_desc(desc: DescriptorGenerator, text: [string, string]) {
    const gold = this.data.color !== 'normal'
    const binder = (card: CardInstance) => {
      return desc(card, gold)
    }
    await this.bind_desc(binder, text[gold ? 1 : 0])
  }

  async clear_desc() {
    for (const d of this.data.descriptors) {
      d.desc.unbind && d.desc.unbind()
      if (d.desc.unique) {
        await this.player.del_unique(d.desc)
      }
    }
    this.data.descriptors = []
  }

  async seize(
    target: CardInstance,
    option?: {
      unreal?: boolean
      upgrade?: boolean // 是否夺取升级
    }
  ) {
    await this.obtain_unit(target.data.units)
    if (option?.upgrade) {
      for (const u of target.data.upgrades) {
        await this.obtain_upgrade(u)
      }
    }
    if (!option?.unreal) {
      await this.post('seize', {
        ...refC(this),
        target,
      })
    }
    await this.player.destroy(target)
  }

  async regroup(id = 0) {
    await this.post('regroup', {
      ...refC(this),
      id,
    })
  }

  async gain_darkness(dark: number) {
    if (!this.attrib.has('dark')) {
      return
    }
    this.attrib.set('dark', this.attrib.get('dark') + dark)
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
      .map((u, i) => [u, i] as [UnitKey, number])
      .filter(([u]) => pred(u))
      .map(([u, i]) => i)
      .slice(0, maxi)
  }

  bind() {
    this.bus.on('round-end', async () => {
      // 高科的快产
      if (this.data.race === 'T' && this.data.infr[0] === 'hightech') {
        await this.post('fast-prod', refC(this))
      }
    })
    this.bus.on('post-sell', async () => {
      const n = this.find('虚空水晶塔').length
      if (n > 0) {
        for (const c of this.around()) {
          if (c.data.race === 'P') {
            await c.obtain_unit(us('虚空水晶塔', n))
            break
          }
        }
      }
    })
  }
}
