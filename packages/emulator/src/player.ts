import { computed, reactive } from '@vue/reactivity'
import {
  AllUpgrade,
  Card,
  CardKey,
  getCard,
  getUpgrade,
  Race,
  UnitKey,
  Upgrade,
  RoleKey,
} from '@sctavern-emulator/data'
import { AttributeManager, CombineAttribute } from './attribute'
import { CardInstance, CardInstanceAttrib } from './card'
import { Descriptors } from './descriptor'
import { create_mutation, create_role, RoleData, RoleImpl } from './role'
import {
  Descriptor,
  DescriptorGenerator,
  DistributiveOmit,
  PlayerConfig,
} from './types'
import { autoBind, isCardInstance, isCardInstanceAttrib, us } from './utils'
import { DispatchTranslator, GetMsg, MsgKeyOf } from './dispatcher'
import { InputMsg, InnerMsg, OutterMsg } from './events'
import { GameInstance } from './game'

interface ActionItem {
  name: string
  message: InputMsg
  accelerator: string
  enable: boolean
}

export type StoreStatus = {
  special: boolean
  locked: boolean
}

export interface PlayerAttrib {
  level: number
  upgrade_cost: number
  life: number

  mineral: number
  mineral_max: number
  gas: number

  selected: {
    area: 'hand' | 'store' | 'present' | 'none'
    choice: number
  }
  locked: boolean
  doned: boolean

  config: PlayerConfig

  globalActs: ActionItem[]

  store: (CardKey | null)[]
  storeActs: ActionItem[][]
  storeStatus: StoreStatus[]
  hand: (CardKey | null)[]
  handActs: ActionItem[][]
  present: (CardInstanceAttrib | null)[]
  presentActs: ActionItem[][]

  ability: RoleData

  value: number
  first_hole: number
}

interface UniqueDescInfo {
  card: CardInstance
  desc: Descriptor
}

export class Player extends DispatchTranslator<MsgKeyOf<InnerMsg>, InnerMsg> {
  game: GameInstance
  role: RoleImpl
  pos: number

  data: PlayerAttrib

  present: (CardInstance | null)[]

  unique: Record<string, UniqueDescInfo[]>

  attrib: AttributeManager
  persisAttrib: AttributeManager

  resolves: Record<
    'insert' | 'discover' | 'deploy',
    ((v: number) => void) | null
  >

  constructor(game: GameInstance, pos: number, role: RoleKey) {
    super(msg => {
      if ('card' in msg) {
        if (msg.card instanceof CardInstance) {
          return [msg.card]
        } else {
          const s = this.present[msg.card]
          return s ? [s] : []
        }
      } else {
        return this.present.filter(isCardInstance)
      }
    })

    this.game = game
    this.pos = pos
    this.data = reactive({
      level: 1,
      upgrade_cost: 6,
      life: 100,

      mineral: 0,
      mineral_max: 2,
      gas: -1,

      selected: {
        area: 'none',
        choice: -1,
      },
      locked: false,
      doned: false,

      config: {
        MaxUnitPerCard: 200,
        MaxUpgradePerCard: 5,
        AlwaysInsert: false,

        StoreCount: [0, 3, 4, 4, 5, 5, 6],
        UpgradeCost: [0, 5, 7, 8, 9, 11, 0],

        MaxMineral: 10,
        MaxGas: 6,
      },

      globalActs: computed<ActionItem[]>(() => [
        {
          name: '升级',
          message: { msg: '$upgrade', player: this.pos },
          accelerator: 'w',
          enable: this.can_tavern_upgrade(),
        },
        {
          name: '刷新',
          message: { msg: '$refresh', player: this.pos },
          accelerator: 'r',
          enable: this.can_refresh(),
        },
        {
          name: this.data.locked ? '解锁' : '锁定',
          message: {
            msg: this.data.locked ? '$unlock' : '$lock',
            player: this.pos,
          },
          accelerator: 'c',
          enable: true,
        },
        {
          name: '下一回合',
          message: { msg: '$finish', player: this.pos },
          accelerator: 'z',
          enable: !this.data.doned,
        },
      ]),

      store: Array(3).fill(null),
      storeActs: computed<ActionItem[][]>(() => {
        return this.data.store.map((k, i) => {
          const res: ActionItem[] = []
          if (k) {
            if (this.can_combine(k)) {
              res.push({
                name: '三连',
                message: {
                  msg: '$action',
                  area: 'store',
                  action: 'combine',
                  choice: i,
                  player: this.pos,
                },
                accelerator: 'e',
                enable: this.can_buy(k, 'combine', i),
              })
            } else {
              res.push({
                name: '进场',
                message: {
                  msg: '$action',
                  area: 'store',
                  action: 'enter',
                  choice: i,
                  player: this.pos,
                },
                accelerator: 'e',
                enable: this.can_buy(k, 'enter', i) && this.can_enter(k),
              })
            }
            res.push({
              name: '暂存',
              message: {
                msg: '$action',
                area: 'store',
                action: 'stage',
                choice: i,
                player: this.pos,
              },
              accelerator: 'v',
              enable: this.can_buy(k, 'stage', i) && this.can_stage(),
            })
          }
          return res
        })
      }),
      storeStatus: computed<StoreStatus[]>(() => {
        return this.data.store.map(k => ({
          locked: !!k && this.data.locked,
          special: false,
        }))
      }),

      hand: Array(6).fill(null),
      handActs: computed<ActionItem[][]>(() => {
        return this.data.hand.map((k, i) => {
          const res: ActionItem[] = []
          if (k) {
            if (this.can_combine(k)) {
              res.push({
                name: '三连',
                message: {
                  msg: '$action',
                  area: 'hand',
                  action: 'combine',
                  choice: i,
                  player: this.pos,
                },
                accelerator: 'e',
                enable: true,
              })
            } else {
              res.push({
                name: '进场',
                message: {
                  msg: '$action',
                  area: 'hand',
                  action: 'enter',
                  choice: i,
                  player: this.pos,
                },
                accelerator: 'e',
                enable: this.can_enter(k),
              })
            }
            res.push({
              name: '出售',
              message: {
                msg: '$action',
                area: 'hand',
                action: 'sell',
                choice: i,
                player: this.pos,
              },
              accelerator: 's',
              enable: true,
            })
          }
          return res
        })
      }),
      present: Array(7).fill(null),
      presentActs: computed<ActionItem[][]>(() => {
        return this.data.present.map((ca, i) => {
          const res: ActionItem[] = []
          if (ca) {
            res.push({
              name: '升级',
              message: {
                msg: '$action',
                area: 'present',
                action: 'upgrade',
                choice: i,
                player: this.pos,
              },
              accelerator: 'g',
              enable: this.can_pres_upgrade(ca),
            })
            res.push({
              name: '出售',
              message: {
                msg: '$action',
                area: 'present',
                action: 'sell',
                choice: i,
                player: this.pos,
              },
              accelerator: 's',
              enable: true,
            })
          }
          return res
        })
      }),

      ability: {
        data: {
          type: 'role',
          name: '白板',
          ability: '',
          desc: '',
        },
        prog_cur: -1,
        prog_max: 0,
        enable: false,
        enpower: false,
      },

      value: computed(() => {
        return this.data.present
          .filter(isCardInstanceAttrib)
          .map(c => c.value)
          .reduce((a, b) => a + b, 0)
      }),
      first_hole: computed(() => {
        const place = this.data.present
          .map((c, i) => [c, i] as [CardInstanceAttrib, number])
          .filter(([c]) => !isCardInstanceAttrib(c))
          .map(([c, i]) => i)
        return place.length > 0 ? place[0] : -1
      }),
    })

    this.present = Array(7).fill(null)

    this.unique = {}

    this.attrib = new AttributeManager()
    this.persisAttrib = new AttributeManager()

    this.resolves = {
      insert: null,
      discover: null,
      deploy: null,
    }

    this.bind_inputs()
    this.bind_default()

    this.role = create_role(this, role)
    this.data.ability = this.role.data

    for (const m of this.game.config.mutation) {
      create_mutation(this, m)
    }
  }

  async post<
    T extends DistributiveOmit<Extract<InnerMsg, { player: number }>, 'player'>
  >(msg: T): Promise<T & { player: number }> {
    const rm = {
      player: this.pos,
      ...msg,
    }
    await this.game.$game.emit(rm)
    return rm
  }

  async postClient<
    T extends DistributiveOmit<Extract<OutterMsg, { client: number }>, 'client'>
  >(msg: T): Promise<T & { client: number }> {
    const rm = {
      client: this.pos,
      ...msg,
    }
    await this.game.$client.emit(rm)
    return rm
  }

  find_name(name: string) {
    return this.present
      .filter(isCardInstance)
      .filter(card => card.data.name === name)
  }

  all_of(race: Race): CardInstance[] {
    return this.present.filter(isCardInstance).filter(c => c.data.race === race)
  }

  count_present(): {
    [key in Race]: number
  } {
    const res = {
      T: 0,
      P: 0,
      Z: 0,
      N: 0,
      G: 0,
    }
    this.present.filter(isCardInstance).forEach(c => {
      res[c.data.race] += 1
    })
    return res
  }

  async discover(
    item: (Card | Upgrade | string)[],
    option?: {
      target?: CardInstance
      extra?: string
      nodrop?: boolean
      fake?: (cho: number) => void
    }
  ): Promise<boolean> {
    const choice = await this.queryDiscover(item, option?.extra)
    if (choice === -1) {
      return false
    }
    if (option?.fake) {
      option?.fake(choice)
      return true
    }
    const cho = item[choice]
    if (typeof cho === 'string') {
      return true
    }
    if (cho.type === 'upgrade') {
      await option?.target?.obtain_upgrade(cho.name)
    } else {
      await this.obtain_card(cho)
      item.splice(choice, 1)
    }
    if (!option?.nodrop) {
      this.game.pool.drop(
        (item.filter(i => typeof i !== 'string') as Card[]).filter(c => c.pool)
      )
    }
    return true
  }

  obtain_resource(resource: { mineral?: number; gas?: number }) {
    this.data.mineral += resource.mineral || 0
    this.data.gas += resource.gas || 0
  }

  async obtain_card(cardt: Card) {
    const idx = this.data.hand.findIndex(x => x === null)
    if (idx === -1) {
      if (
        this.find_name(cardt.name).filter(c => c.data.color === 'normal')
          .length < 2
      ) {
        await this.enter(cardt)
      } else {
        // TODO: 真的会三连吗
        await this.combine(cardt)
      }
    } else {
      this.data.hand[idx] = cardt.name
    }
  }

  async incubate(from: CardInstance, units: UnitKey[]) {
    if (units.length === 0) {
      return
    }
    await this.post({
      msg: 'incubate',
      from,
      units,
    })
    for (const c of from.around()) {
      if (c.data.race === 'Z' || this.role.data.data.name === '分裂池') {
        await c.obtain_unit(units, 'incubate')
      }
    }
  }

  async inject(units: UnitKey[], only_left = false) {
    if (units.length === 0) {
      return
    }
    const isZergling = this.role.data.data.name === '跳虫'
    let egg_cardt = getCard('虫卵')
    let egg_descs = Descriptors['虫卵'] as DescriptorGenerator[]
    if (isZergling) {
      egg_cardt = {
        ...egg_cardt,
      }
      egg_cardt.desc = [
        [
          '出售该卡牌时, 尝试将此卡牌的单位转移到另一张虫卵牌上',
          '出售该卡牌时, 尝试将此卡牌的单位转移到另一张虫卵牌上',
        ],
      ]
      egg_descs = [
        autoBind('post-sell', async card => {
          const another = card.player.find_name('虫卵')
          if (another.length > 0) {
            await another[0].obtain_unit(card.data.units)
          }
        }),
      ]
    }

    let eggs = this.find_name('虫卵')
    const expectCount = isZergling && this.data.level >= 4 ? 2 : 1
    while (eggs.length < expectCount) {
      const hole = this.data.first_hole
      if (hole === -1) {
        break
      }
      const egg = new CardInstance(this, egg_cardt)
      egg.data.color = 'gold'
      for (let i = 0; i < egg_descs.length; i++) {
        egg.add_desc(egg_descs[i], egg_cardt.desc[i])
      }
      this.put(egg, hole)
      eggs = this.find_name('虫卵')
    }
    if (eggs.length > 0) {
      if (only_left) {
        await eggs[0].obtain_unit(units)
      } else {
        for (const e of eggs) {
          await e.obtain_unit(units)
        }
      }
      await this.post({
        msg: 'inject',
        units,
      })
    }
  }

  async wrap(units: UnitKey[]) {
    if (units.length === 0) {
      return
    }
    const param = await this.post({
      msg: 'wrap',
      units,
      into: null as CardInstance | null,
    })
    if (param.into === null) {
      const targets = this.present
        .filter(isCardInstance)
        .filter(x => x.data.race === 'P') as CardInstance[]
      if (!targets.length) {
        return
      }
      this.game.gen.shuffle(targets)
      param.into = targets[0]
    }
    if (param.into) {
      param.into.obtain_unit(units, 'wrap')
    }
  }

  resort_unique(name: string) {
    const data = this.unique[name]
    if (data.length === 0) {
      return
    }
    const desc = data[0].desc
    data.sort((a, b) => {
      if (!!a.desc.manualDisable !== !!b.desc.manualDisable) {
        return a.desc.manualDisable ? 1 : -1
      } else if (desc.uniqueNoGold || a.desc.gold === b.desc.gold) {
        return a.card.data.pos - b.card.data.pos
      } else {
        return a.desc.gold ? -1 : 1
      }
    })
    if (data.length >= 0) {
      data[0].desc.disabled = !!data[0].desc.manualDisable
      data.slice(1).forEach(({ desc: d }) => {
        d.disabled = true
      })
    }
  }

  add_unique(card: CardInstance, desc: Descriptor) {
    const key = desc.unique
    if (!key) {
      return
    }
    const data = this.unique[key] || []
    this.unique[key] = data
    data.push({
      card,
      desc,
    })
    this.resort_unique(key)
  }

  del_unique(desc: Descriptor) {
    const key = desc.unique
    if (!key) {
      return
    }
    const data = this.unique[key] || []
    this.unique[key] = data

    const idx = data.findIndex(v => v.desc === desc)
    if (idx === -1) {
      return
    }
    if (idx === 0) {
      data.shift()
      if (data.length > 0) {
        data[0].desc.disabled = false
      }
    } else {
      data.splice(idx, 1)
    }
  }

  private _put(card: CardInstance, pos: number) {
    if (pos === -1) {
      return false
    }
    let p = this.present.indexOf(null, pos)
    if (p !== -1) {
      for (let i = p; i > pos; i--) {
        const ci = this.present[i - 1] as CardInstance
        this.present[i] = ci
        ci.data.pos = i
        this.data.present[i] = ci.data
      }
      this.present[pos] = card
      card.data.pos = pos
      this.data.present[pos] = card.data
      return true
    }
    p = this.present.lastIndexOf(null)
    if (p !== -1) {
      for (let i = p; i < pos; i++) {
        const ci = this.present[i + 1] as CardInstance
        this.present[i] = ci
        ci.data.pos = i
        this.data.present[i] = ci.data
      }
      this.present[pos] = card
      card.data.pos = pos
      this.data.present[pos] = card.data
      return true
    }
    return false
  }

  put(card: CardInstance, pos: number) {
    return this._put(card, pos)
  }

  unput(card: CardInstance) {
    this.present[card.data.pos] = null
    this.data.present[card.data.pos] = null
  }

  async enter(cardt: Card): Promise<CardInstance | null> {
    if (cardt.attr.type === 'support') {
      if (!this.can_enter(cardt.name)) {
        return null
      }
      const pos = await this.queryDeploy()
      const target = this.present[pos] as CardInstance
      const card = new CardInstance(this, cardt)
      const descs = Descriptors[cardt.name]
      if (descs) {
        for (let i = 0; i < descs.length; i++) {
          card.add_desc(descs[i], cardt.desc[i])
        }
      } else {
        console.log('WARN: Card Not Implement Yet')
      }
      await card.post({
        msg: 'post-deploy',
        target,
      })
      card.clear_desc()
      return null
    }
    let pos = this.data.first_hole
    if (pos === -1) {
      return null
    }
    if (cardt.attr.insert || this.data.config.AlwaysInsert) {
      pos = await this.queryInsert()
    }
    const card = new CardInstance(this, cardt)
    if (cardt.pool) {
      card.data.occupy.push(cardt.name)
    }
    this.put(card, pos)

    for (const k in cardt.unit) {
      card.data.units.push(...Array(cardt.unit[k as UnitKey]).fill(k))
    }

    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        card.add_desc(descs[i], cardt.desc[i])
      }
    } else {
      console.log('WARN: Card Not Implement Yet')
    }

    await this.post({
      msg: 'card-entered',
      target: card,
    })

    await card.post({
      msg: 'post-enter',
    })

    return card
  }

  async combine(cardt: Card) {
    const cs = this.find_name(cardt.name).filter(c => c.data.color === 'normal')
    if (cs.length < 2) {
      return false
    }

    cs[0].data.color = 'gold'

    if (cardt.race === 'T') {
      const i1 = cs[0].data.infr
      const i2 = cs[1].data.infr
      if (i1[0] !== 'hightech' && i2[0] === 'hightech') {
        cs[0].data.units[i1[1]] = '高级科技实验室'
      }
      cs[1].data.units.splice(i2[1], 1)
    }
    cs[0].data.units = cs[0].data.units
      .concat(cs[1].data.units)
      .slice(0, this.data.config.MaxUnitPerCard)

    cs[1].data.upgrades.forEach(uk => {
      const u = getUpgrade(uk)
      if (!u.override && cs[0].data.upgrades.indexOf(uk) !== -1) {
        return
      }
      cs[0].data.upgrades.push(uk)
    })

    cs[0].data.upgrades = cs[0].data.upgrades.slice(
      0,
      this.data.config.MaxUpgradePerCard
    )

    cs[0].attrib = CombineAttribute(
      cs[0].attrib,
      cs[1].attrib,
      (name, v1, v2) => {
        switch (name) {
          case 'task':
            return 0
          case 'void':
            return Math.max(v1, v2)
          default:
            return v1 + v2
        }
      }
    )
    cs[0].view.clean()

    cs[0].data.occupy.push(...cs[1].data.occupy, cardt.name)

    cs[0].clear_desc()
    cs[1].clear_desc()

    this.unput(cs[1])

    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        cs[0].add_desc(descs[i], cardt.desc[i])
      }
    }
    cs[0].bindDef()

    await this.post({
      msg: 'card-combined',
      target: cs[0],
    })

    await cs[0].post({
      msg: 'post-enter',
    })

    const reward: (Card | Upgrade)[] = this.game.pool.discover(
      c => c.level === Math.min(6, this.data.level + 1),
      3,
      true
    )
    if (cs[0].data.upgrades.length < this.data.config.MaxUpgradePerCard) {
      reward.push(
        this.game.gen.shuffle(
          AllUpgrade.map(getUpgrade)
            .filter(u => u.category === '3')
            .filter(u => !cs[0].data.upgrades.includes(u.name))
        )[0]
      )
    }

    await this.discover(reward, {
      target: cs[0],
    })
  }

  async sell(card: CardInstance) {
    const around = card.around()
    const dark = card.data.level >= 4 ? 2 : 1
    const pos = card.data.pos
    const left = card.left()
    const right = card.right()
    card.left = () => left
    card.right = () => right
    this.unput(card)
    card.data.pos = -1
    const doPost = card.data.level > 0 || card.data.name === '虫卵'
    if (doPost) {
      await card.post({
        msg: 'post-sell',
        pos,
      })
    }
    card.clear_desc()
    this.game.pool.drop(card.data.occupy.map(getCard))
    if (doPost) {
      await this.post({
        msg: 'card-selled',
        target: card,
        flag: false,
        pos,
      })
      this.obtain_resource({
        mineral: 1,
      })
      if (card.data.name !== '虫卵') {
        for (const c of around) {
          await c.gain_darkness(dark)
        }
      }
    }
  }

  async destroy(card: CardInstance, overwhelm = false) {
    const around = card.around()
    const dark = card.data.level >= 4 ? 2 : 1
    const left = card.left()
    const right = card.right()
    card.left = () => left
    card.right = () => right
    this.unput(card)
    card.data.pos = -1
    if (overwhelm) {
      await card.post({
        msg: 'post-enter',
      })
    }
    card.clear_desc()
    this.game.pool.drop(card.data.occupy.map(getCard))
    if (card.data.level > 0) {
      for (const c of around) {
        await c.gain_darkness(dark)
      }
    }
  }

  async queryInsert() {
    const client = this.pos
    return new Promise<number>(resolve => {
      let quit = false
      this.resolves.insert = (v: number) => {
        quit = true
        this.game.$client
          .emit({
            msg: 'insert',
            time: 'end',
            client,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.$client.emit({
        msg: 'insert',
        time: 'begin',
        client,
      })
      this.game.slave.poll(() => quit)
    })
  }

  async queryDiscover(item: (Card | Upgrade | string)[], extra?: string) {
    const client = this.pos
    return new Promise<number>(resolve => {
      let quit = false
      this.resolves.discover = (v: number) => {
        quit = true
        this.game.$client
          .emit({
            msg: 'discover',
            time: 'end',
            client,
            item,
            extra,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.$client.emit({
        msg: 'discover',
        time: 'begin',
        client,
        item,
        extra,
      })
      this.game.slave.poll(() => quit)
    })
  }

  async queryDeploy() {
    const client = this.pos
    return new Promise<number>(resolve => {
      let quit = false
      this.resolves.deploy = (v: number) => {
        quit = true
        this.game.$client
          .emit({
            msg: 'deploy',
            time: 'end',
            client,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.$client.emit({
        msg: 'deploy',
        time: 'begin',
        client,
      })
      this.game.slave.poll(() => quit)
    })
  }

  private fill_store() {
    const nf = this.data.store.filter(c => !c).length
    const nc = this.game.pool.discover(
      card => card.level <= this.data.level,
      nf
    )
    for (let i = 0; i < this.data.store.length; i++) {
      if (!this.data.store[i]) {
        this.data.store[i] = nc.shift()?.name || null
      }
    }
  }

  current_selected(): CardInstance | CardKey | null {
    switch (this.data.selected.area) {
      case 'hand':
        return this.data.hand[this.data.selected.choice]
      case 'store':
        return this.data.store[this.data.selected.choice]
      case 'present':
        return this.present[this.data.selected.choice]
      case 'none':
        return null
    }
  }

  async do_refresh() {
    this.game.pool.drop(
      (this.data.store.filter(x => x !== null) as CardKey[]).map(getCard)
    )
    this.data.store.fill(null)
    this.fill_store()
    this.post({
      msg: 'store-refreshed',
    })
  }

  bind_inputs() {
    this.$on({
      $upgrade: async () => {
        if (
          this.data.level < 6 &&
          this.data.mineral >= this.data.upgrade_cost
        ) {
          this.data.mineral -= this.data.upgrade_cost
          this.data.level += 1
          this.data.upgrade_cost = this.data.config.UpgradeCost[this.data.level]
          if (
            this.data.store.length <
            this.data.config.StoreCount[this.data.level]
          ) {
            this.data.store.push(null)
          }
          await this.post({
            msg: 'tavern-upgraded',
            level: this.data.level,
          })
        }
      },
      $refresh: async () => {
        if (this.data.mineral < this.role.refresh_cost()) {
          return
        }
        this.data.mineral -= this.role.refresh_cost()
        await this.do_refresh()

        await this.role.refreshed()
      },
      $finish: async () => {
        this.data.doned = true
        await this.game.add_done()
      },
      $ability: async () => {
        if (!this.data.ability.enable) {
          return
        }
        await this.role.ability()
      },
      $lock: async () => {
        this.data.locked = true
      },
      $unlock: async () => {
        this.data.locked = false
      },
      $select: async ({ area, choice }) => {
        this.data.selected = {
          area,
          choice,
        }
        await this.postClient({
          msg: 'selected',
          area,
          choice,
        })
      },
      $choice: async ({ category, choice }) => {
        const r = this.resolves[category]
        if (r) {
          this.resolves[category] = null
          r(choice)
        }
      },
      $action: async ({ area, action, choice }) => {
        switch (area) {
          case 'store': {
            const ck = this.data.store[choice]
            if (!ck || !this.can_buy(ck, action, choice)) {
              return
            }
            switch (action) {
              case 'enter':
                if (!this.can_enter(ck)) {
                  return
                }
                break
              case 'combine':
                if (!this.can_combine(ck)) {
                  return
                }
                break
              case 'stage':
                if (!this.can_stage()) {
                  return
                }
                break
            }
            this.data.mineral -= this.role.buy_cost(ck, action, choice)

            switch (action) {
              case 'enter':
                await this.enter(getCard(ck))
                break
              case 'combine':
                await this.combine(getCard(ck))
                break
              case 'stage':
                this.data.hand[this.data.hand.findIndex(v => v === null)] = ck
                break
            }

            this.data.store[choice] = null

            if (action !== 'combine') {
              await this.role.bought(choice)
            }
            break
          }
          case 'hand': {
            const ck = this.data.hand[choice]
            if (!ck) {
              return
            }
            switch (action) {
              case 'enter':
                if (!this.can_enter(ck)) {
                  return
                }
                break
              case 'combine':
                if (!this.can_combine(ck)) {
                  return
                }
                break
            }

            this.data.hand[choice] = null

            switch (action) {
              case 'enter':
                await this.enter(getCard(ck))
                break
              case 'combine':
                await this.combine(getCard(ck))
                break
              case 'sell':
                if (getCard(ck).attr.type !== 'support') {
                  this.obtain_resource({
                    mineral: 1,
                  })
                }
                break
            }
            break
          }
          case 'present': {
            const c = this.present[choice]
            if (!c) {
              return
            }
            switch (action) {
              case 'sell':
                await this.sell(c)
                break
              case 'upgrade': {
                if (!this.can_pres_upgrade(c.data)) {
                  return
                }

                if (
                  c.data.upgrades.length >= this.data.config.MaxUpgradePerCard
                ) {
                  return
                }
                const comm: Upgrade[] = [],
                  spec: Upgrade[] = []
                AllUpgrade.filter(u => !c.data.upgrades.includes(u))
                  .map(getUpgrade)
                  .forEach(u => {
                    switch (u.category) {
                      case 'O':
                        if (c.data.belong === 'origin') {
                          spec.push(u)
                        }
                        break
                      case 'V':
                        if (c.data.belong === 'void') {
                          spec.push(u)
                        }
                        break
                      case 'T':
                      case 'P':
                      case 'Z':
                        if (c.data.race === u.category) {
                          spec.push(u)
                        }
                        break
                      case 'C':
                        comm.push(u)
                        break
                    }
                  })
                this.game.gen.shuffle(spec)
                const firstUpgrade = c.data.upgrades.length === 0
                const sp = spec.slice(
                  0,
                  firstUpgrade ? (c.data.belong === 'origin' ? 3 : 2) : 1
                )
                const item = this.game.gen
                  .shuffle(comm)
                  .slice(0, 4 - sp.length)
                  .concat(sp)
                this.obtain_resource({
                  gas: -2,
                })
                if (
                  !(await this.discover(item, {
                    target: c,
                    extra: '放弃',
                  }))
                ) {
                  this.obtain_resource({
                    gas: 1,
                  })
                  await this.post({
                    msg: 'upgrade-cancelled',
                    target: c,
                  })
                }
                break
              }
            }
            break
          }
        }
      },
      $cheat: async msg => {
        switch (msg.type) {
          case 'card':
            if (!this.can_stage()) {
              return
            }
            this.data.hand[this.data.hand.findIndex(v => v === null)] =
              msg.cardt
            break
          case 'unit':
            if (!this.data.present[msg.place]) {
              return
            }
            await this.present[msg.place]?.obtain_unit(msg.units)
            break
          case 'resource':
            this.obtain_resource({
              mineral: 100,
              gas: 100,
            })
            break
        }
      },
    })
  }

  bind_default() {
    this.$on({
      'round-start': async () => {
        this.data.doned = false
        this.attrib.clean()
        if (this.data.upgrade_cost > 0) {
          this.data.upgrade_cost -= 1
        }
        if (this.data.mineral_max < this.data.config.MaxMineral) {
          this.data.mineral_max += 1
        }
        this.data.mineral = this.data.mineral_max
        if (this.data.gas < this.data.config.MaxGas) {
          this.data.gas += 1
        }
        if (this.persisAttrib.get('R解放者_模式')) {
          return
        }
        if (!this.data.locked) {
          this.game.pool.drop(
            (this.data.store.filter(x => x !== null) as CardKey[]).map(getCard)
          )
          this.data.store.fill(null)
        }
        this.data.locked = false
        this.fill_store()
      },
      'card-selled': async ({ target }) => {
        if (target.data.race === 'N') {
          for (const c of this.present.filter(isCardInstance)) {
            await c.obtain_unit(
              us(
                '原始异龙',
                c.data.upgrades.filter(u => u === '原始尖塔').length
              )
            )
          }
        }
      },
    })
  }

  can_buy(ck: CardKey, act: 'enter' | 'combine' | 'stage', place: number) {
    return this.data.mineral >= this.role.buy_cost(ck, act, place)
  }

  can_enter(ck: CardKey) {
    if (getCard(ck).attr.type === 'support') {
      return this.data.present.filter(isCardInstanceAttrib).length > 0
    } else {
      return this.data.present.filter(c => !isCardInstanceAttrib(c)).length > 0
    }
  }

  can_combine(ck: CardKey) {
    return (
      this.data.present
        .filter(isCardInstanceAttrib)
        .filter(card => card.name === ck)
        .filter(c => c.color === 'normal').length >= 2
    )
  }

  can_stage() {
    return this.data.hand.filter(x => x).length < 6
  }

  can_pres_upgrade(c: CardInstanceAttrib) {
    return (
      c.upgrades.length < this.data.config.MaxUpgradePerCard &&
      this.data.gas >= 2
    )
  }

  can_tavern_upgrade() {
    return this.data.level < 6 && this.data.mineral >= this.data.upgrade_cost
  }

  can_refresh() {
    return this.data.mineral >= this.role.refresh_cost()
  }
}
