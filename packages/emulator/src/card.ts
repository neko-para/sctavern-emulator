import { reactive, computed } from '@vue/reactivity'
import { AttributeManager, AttributeViewer } from './attribute'
import {
  Race,
  UnitKey,
  UpgradeKey,
  CardKey,
  Card,
  getUnit,
  getUpgrade,
  getCard,
} from '@sctavern-emulator/data'
import { Descriptors } from './descriptor'
import { Player } from './player'
import {
  Descriptor,
  DescriptorGenerator,
  ObtainUnitWay,
  DescriptorInfo,
  DistributiveOmit,
} from './types'
import {
  autoBind,
  isCardInstance,
  isCardInstanceAttrib,
  mostValueUnit,
  us,
} from './utils'
import { InnerMsg } from './events'
import { DispatchTranslator, MsgKeyOf } from './dispatcher'

export interface CardInstanceAttrib {
  pos: number

  name: string
  race: Race
  level: number

  color: 'normal' | 'gold' | 'darkgold'

  units: UnitKey[]
  upgrades: UpgradeKey[]

  belong: 'none' | 'origin' | 'void' | 'building'

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

export class CardInstance extends DispatchTranslator<
  MsgKeyOf<InnerMsg>,
  InnerMsg
> {
  player: Player

  readonly data: CardInstanceAttrib

  attrib: AttributeManager
  view: AttributeViewer

  constructor(player: Player, cardt: Card) {
    super(() => [])

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
        return this.view.views()
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
            .reduce((a, b) => a + b, 0) + this.attrib.get('????????????')
        )
      }),
      self_power: computed(() => {
        return (
          this.find('?????????').length +
          this.find('???????????????').length +
          this.attrib.get('??????')
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
          idx = this.data.units.indexOf('?????????')
          if (idx !== -1) {
            return ['reactor', idx]
          }
          idx = this.data.units.indexOf('???????????????')
          if (idx !== -1) {
            return ['scilab', idx]
          }
          idx = this.data.units.indexOf('?????????????????????')
          if (idx !== -1) {
            return ['hightech', idx]
          }
          return ['none', -1]
        }
      ),
    })

    this.attrib = new AttributeManager()
    this.view = new AttributeViewer()

    if (cardt.attr.origin) {
      this.data.belong = 'origin'
    } else if (cardt.attr.void) {
      this.data.belong = 'void'
      this.set_void()
    } else if (cardt.attr.type === 'building') {
      this.data.belong = 'building'
    }

    if (cardt.attr.dark) {
      this.attrib.set('dark', 0)
    }

    this.bind()
    this.bindDef()
  }

  bindDef() {
    switch (this.data.belong) {
      case 'origin':
        this.view.set('origin', () => {
          return '??????????????????'
        })
        break
      case 'building':
        this.view.set('building', () => {
          return '?????????'
        })
        break
    }

    this.view.set('power', () => {
      if (this.data.race === 'P' || this.data.power > 0) {
        return `????????????: ${this.data.power}`
      } else {
        return ''
      }
    })

    this.view.set('dark', () => {
      if (this.attrib.has('dark')) {
        return `?????????: ${this.attrib.get('dark')}`
      } else {
        return ''
      }
    })

    this.view.set('void', () => {
      if (this.attrib.has('void')) {
        return '????????????'
      } else {
        return ''
      }
    })
  }

  async post<
    T extends DistributiveOmit<
      Extract<InnerMsg, { player: number; card: number | CardInstance }>,
      'player' | 'card'
    >
  >(msg: T): Promise<T & { player: number; card: number | CardInstance }> {
    const rm = {
      player: this.player.pos,
      card: this.data.pos === -1 ? this : this.data.pos,
      ...msg,
    }
    await this.player.game.$game.emit(rm)
    return rm
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
    this.attrib.set('void', 1)
  }

  async switch_infr() {
    if (this.data.race !== 'T') {
      return
    }
    const [type, pos] = this.data.infr
    switch (type) {
      case 'reactor':
        this.replace_unit([pos], '???????????????')
        break
      case 'scilab':
        this.replace_unit([pos], '?????????')
        break
      default:
        return
    }
    await this.player.post({
      msg: 'infr-changed',
      target: this,
    })
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
        this.replace_unit([pos], '?????????????????????')
        await this.player.post({
          msg: 'infr-changed',
          target: this,
        })
        await this.fast_prod()
        break
    }
  }

  async fast_prod() {
    await this.post({
      msg: 'fast-produce',
    })
  }

  async obtain_unit(units: UnitKey[], way: ObtainUnitWay = 'normal') {
    const p = await this.post({
      msg: 'obtain-unit',
      time: 'prev',
      units,
      way,
    })
    this.data.units = this.data.units
      .concat(p.units)
      .slice(0, this.player.data.config.MaxUnitPerCard)
    await this.post({
      msg: 'obtain-unit',
      time: 'post',
      units: p.units,
      way: p.way,
    })
  }

  remove_unit(index: number[]) {
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
        case '????????????':
          await this.obtain_unit([
            ...us('?????????', 2),
            ...us('?????????', 2),
            ...us('?????????', 2),
          ])
          break
        case '???????????????':
          await this.obtain_unit([
            ...us('???????????????', this.player.data.level + 3),
          ])
          break
        case '????????????': {
          this.clear_desc()
          const descs = Descriptors.????????????
          this.data.color = 'gold'
          if (descs) {
            for (let i = 0; i < descs.length; i++) {
              this.add_desc(descs[i], getCard('????????????').desc[i])
            }
          } else {
            console.log('WARN: Card Not Implement Yet')
          }
          break
        }
        case '??????': {
          const vo = (unit: UnitKey) => {
            if (unit === '?????????????????' || unit === '????????????') {
              return 10000
            } else {
              return getUnit(unit).value
            }
          }
          const idx = mostValueUnit(this.data.units, (a, b) => a > b, vo)[1]
          const rst = this.data.units.filter((u, i) => idx !== i).map(getUnit)

          const sum =
            rst
              .map(u => u.health + (u.shield || 0))
              .reduce((a, b) => a + b, 0) * 1.5

          const vsum = rst.map(u => u.value).reduce((a, b) => a + b, 0)

          this.data.units = [this.data.units[idx]]
          this.attrib.set('??????', sum)
          this.attrib.set('????????????', vsum)
          this.view.set(
            '??????',
            () => `??????????????????: ${this.attrib.get('??????')}`
          )
          this.add_desc(
            autoBind('obtain-unit', async (card, gold, msg) => {
              if (msg.time === 'prev') {
                card.attrib.alter(
                  '??????',
                  msg.units
                    .map(getUnit)
                    .map(u => u.health + (u.shield || 0))
                    .reduce((a, b) => a + b, 0) * 1.5
                )
                card.attrib.alter(
                  '????????????',
                  msg.units
                    .map(getUnit)
                    .map(u => u.value)
                    .reduce((a, b) => a + b, 0)
                )
                msg.units = []
              }
            }),
            ['?????????????????????????????????', '?????????????????????????????????']
          )
        }
      }
      await this.post({
        msg: 'obtain-upgrade',
        upgrade,
      })
    }
  }

  replace_unit(places: number[], unit: UnitKey | ((u: UnitKey) => UnitKey)) {
    const proc = typeof unit === 'string' ? () => unit : unit
    places.forEach(idx => {
      if (idx >= 0 && idx < this.data.units.length) {
        this.data.units[idx] = proc(this.data.units[idx])
      }
    })
  }

  filter(func: (unit: UnitKey, pos: number) => boolean, maxi = -1) {
    const taked: UnitKey[] = []
    if (maxi === -1) {
      maxi = this.data.units.length
    }
    this.data.units = this.data.units.filter((u, i) => {
      if (func(u, i) && taked.length < maxi) {
        taked.push(u)
        return false
      } else {
        return true
      }
    })
    return taked
  }

  bind_desc(
    binder: (card: CardInstance) => Descriptor,
    text: string,
    data: {
      desc: DescriptorGenerator
      text: [string, string]
    }
  ) {
    const d = binder(this)
    this.data.descriptors.push({
      text,
      desc: d,
      bind: binder,
      data,
    })
    if (d.unique) {
      this.player.add_unique(this, d)
    }
  }

  add_desc(desc: DescriptorGenerator, text: [string, string]) {
    const gold = this.data.color !== 'normal'
    const binder = (card: CardInstance) => {
      return desc(card, gold)
    }
    this.bind_desc(binder, text[gold ? 1 : 0], {
      desc,
      text,
    })
  }

  clear_desc() {
    for (const d of this.data.descriptors) {
      d.desc.unbind && d.desc.unbind()
      if (d.desc.unique) {
        this.player.del_unique(d.desc)
      }
    }
    this.data.descriptors = []
  }

  async seize(
    target: CardInstance,
    option?: {
      unreal?: boolean
      upgrade?: boolean // ??????????????????
    }
  ) {
    if (!option?.unreal) {
      await this.player.post({
        msg: 'seize',
        target,
        from: this,
      })
    }
    await this.obtain_unit(target.data.units)
    if (option?.upgrade) {
      for (const u of target.data.upgrades) {
        await this.obtain_upgrade(u)
      }
    }
    await this.player.destroy(target)
  }

  async incubate(id = 0) {
    await this.post({
      msg: 'req-incubate',
      id,
    })
  }

  async regroup(id = 0) {
    await this.post({
      msg: 'req-regroup',
      id,
    })
  }

  async gain_darkness(darkness: number) {
    if (!this.attrib.has('dark')) {
      return
    }
    this.attrib.alter('dark', darkness)
    if (darkness > 0) {
      await this.post({
        msg: 'obtain-darkness',
        darkness,
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
    this.$on({
      'round-end': async () => {
        if (this.data.race === 'T' && this.data.infr[0] === 'hightech') {
          await this.fast_prod()
        }
      },
      'post-sell': async () => {
        const n = this.find('???????????????').length
        if (n > 0) {
          for (const c of this.around()) {
            if (c.data.race === 'P') {
              await c.obtain_unit(us('???????????????', n))
              break
            }
          }
        }
      },
    })
  }
}
