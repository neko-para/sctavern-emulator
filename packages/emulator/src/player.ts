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
  UpgradeKey,
  RoleKey,
} from '@sctavern-emulator/data'
// import { RoleKey } from 'data'
import { AttributeManager } from './attribute'
import { CardInstance, CardInstanceAttrib } from './card'
import { Descriptors } from './descriptor'
import { Emitter } from './emitter'
import { Game } from './game'
import { create_role, RoleData, RoleImpl } from './role'
import { Descriptor, InputBus, LogicBus, PlayerConfig } from './types'
import { isCardInstance, isCardInstanceAttrib, refC, refP, us } from './utils'

interface ActionItem {
  name: string
  message: keyof InputBus
  accelerator: string
  enable: boolean
}

export interface PlayerAttrib {
  level: number
  upgrade_cost: number

  mineral: number
  mineral_max: number
  gas: number

  selected: string
  locked: boolean
  doned: boolean

  config: PlayerConfig

  globalActs: ActionItem[]

  store: (CardKey | null)[]
  storeActs: ActionItem[][]
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

export class Player {
  bus: Emitter<LogicBus>
  game: Game
  role: RoleImpl
  pos: number

  data: PlayerAttrib

  present: (CardInstance | null)[]

  unique: Record<string, UniqueDescInfo[]>

  attrib: AttributeManager
  persisAttrib: AttributeManager

  insertResolve: ((v: number) => void) | null
  discoverResolve: ((v: number) => void) | null
  deployResolve: ((v: number) => void) | null

  constructor(game: Game, pos: number, role: RoleKey) {
    this.bus = new Emitter('card', [])
    this.game = game
    this.pos = pos
    this.data = reactive({
      level: 1,
      upgrade_cost: 6,
      mineral: 0,
      mineral_max: 2,
      gas: -1,

      selected: 'none',
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
          message: '$upgrade',
          accelerator: 'w',
          enable: this.can_tavern_upgrade(),
        },
        {
          name: '刷新',
          message: '$refresh',
          accelerator: 'r',
          enable: this.can_refresh(),
        },
        {
          name: this.data.locked ? '解锁' : '锁定',
          message: this.data.locked ? '$unlock' : '$lock',
          accelerator: 'c',
          enable: true,
        },
        {
          name: '下一回合',
          message: '$done',
          accelerator: 'z',
          enable: !this.data.doned,
        },
      ]),

      store: Array(3).fill(null),
      storeActs: computed<ActionItem[][]>(() => {
        return this.data.store.map(k => {
          const res: ActionItem[] = []
          if (k) {
            if (this.can_combine(k)) {
              res.push({
                name: '三连',
                message: '$buy-combine',
                accelerator: 'e',
                enable: this.can_buy(k, 'combine'),
              })
            } else {
              res.push({
                name: '进场',
                message: '$buy-enter',
                accelerator: 'e',
                enable: this.can_buy(k, 'enter'),
              })
            }
            res.push({
              name: '暂存',
              message: '$buy-cache',
              accelerator: 'v',
              enable: this.can_buy(k, 'cache') && this.can_cache(),
            })
          }
          return res
        })
      }),
      hand: Array(6).fill(null),
      handActs: computed<ActionItem[][]>(() => {
        return this.data.hand.map(k => {
          const res: ActionItem[] = []
          if (k) {
            if (this.can_combine(k)) {
              res.push({
                name: '三连',
                message: '$hand-combine',
                accelerator: 'e',
                enable: true,
              })
            } else {
              res.push({
                name: '进场',
                message: '$hand-enter',
                accelerator: 'e',
                enable: this.can_enter(k),
              })
            }
            res.push({
              name: '出售',
              message: '$hand-sell',
              accelerator: 's',
              enable: true,
            })
          }
          return res
        })
      }),
      present: Array(7).fill(null),
      presentActs: computed<ActionItem[][]>(() => {
        return this.data.present.map(ca => {
          const res: ActionItem[] = []
          if (ca) {
            res.push({
              name: '升级',
              message: '$present-upgrade',
              accelerator: 'g',
              enable: this.can_pres_upgrade(ca),
            })
            res.push({
              name: '出售',
              message: '$present-sell',
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

    this.insertResolve = null
    this.discoverResolve = null
    this.deployResolve = null

    this.bind_inputs()
    this.bind_default()

    this.role = create_role(this, role)
    this.data.ability = this.role.data
  }

  async post<T extends keyof LogicBus>(msg: T, param: LogicBus[T]) {
    await this.game.post(msg, param)
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
    item: (Card | UpgradeKey)[],
    option?: {
      target?: CardInstance
      cancel?: boolean
      nodrop?: boolean
    }
  ): Promise<boolean> {
    const choice = await this.queryDiscover(item, !!option?.cancel)
    if (choice === -1) {
      return false
    }
    const cho = item[choice]
    if (typeof cho === 'string') {
      await option?.target?.obtain_upgrade(cho)
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

  async obtain_resource(resource: { mineral?: number; gas?: number }) {
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
    await this.post('incubate', {
      ...refP(this),
      from,
      units,
    })
    for (const c of from.around()) {
      if (c.data.race === 'Z') {
        await c.obtain_unit(units, 'incubate')
      }
    }
  }

  async inject(units: UnitKey[]) {
    if (units.length === 0) {
      return
    }
    const eggs = this.find_name('虫卵')
    let egg_card: CardInstance | null = null
    if (eggs.length === 0) {
      const hole = this.data.first_hole
      if (hole === -1) {
        return
      }
      const egg_cardt = getCard('虫卵')
      egg_card = new CardInstance(this, egg_cardt)
      egg_card.data.color = 'gold'
      const descs = Descriptors['虫卵']
      if (descs) {
        for (let i = 0; i < descs.length; i++) {
          await egg_card.add_desc(descs[i], egg_cardt.desc[i])
        }
      }
      await this.put(egg_card, hole)
    } else {
      egg_card = eggs[0]
    }
    if (egg_card) {
      await egg_card.obtain_unit(units)
      await this.post('inject', {
        ...refP(this),
        units,
      })
    }
  }

  async wrap(units: UnitKey[]) {
    if (units.length === 0) {
      return
    }
    const param: LogicBus['wrap'] = {
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
      param.into = targets[0]
    }
    if (param.into) {
      param.into.obtain_unit(units, 'wrap')
    }
  }

  async resort_unique(name: string) {
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

  async add_unique(card: CardInstance, desc: Descriptor) {
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
    await this.resort_unique(key)
  }

  async del_unique(desc: Descriptor) {
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

  private async _put(card: CardInstance, pos: number) {
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

  async put(card: CardInstance, pos: number) {
    if (await this._put(card, pos)) {
      for (let i = 0; i < 7; i++) {
        this.bus.child[i] = this.present[i]?.bus || null
      }
      return true
    } else {
      return false
    }
  }

  async unput(card: CardInstance) {
    this.present[card.data.pos] = null
    this.data.present[card.data.pos] = null
    this.bus.child[card.data.pos] = null
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
          await card.add_desc(descs[i], cardt.desc[i])
        }
      } else {
        console.log('WARN: Card Not Implement Yet')
      }
      await this.post('post-deploy', {
        ...refC(card),
        target,
      })
      await card.clear_desc()
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
        await card.add_desc(descs[i], cardt.desc[i])
      }
    } else {
      console.log('WARN: Card Not Implement Yet')
    }

    await this.post('card-entered', {
      ...refP(this),
      target: card,
    })

    await this.post('post-enter', refC(card))

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

    cs[0].attrib.combine(cs[1].attrib)

    cs[0].data.occupy.push(...cs[1].data.occupy, cardt.name)

    await cs[0].clear_desc()
    await cs[1].clear_desc()

    await this.unput(cs[1])

    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        await cs[0].add_desc(descs[i], cardt.desc[i])
      }
    }
    cs[0].bindDef()

    await this.post('card-combined', {
      ...refP(this),
      target: cs[0],
    })

    await this.post('post-enter', {
      ...refC(cs[0]),
    })

    const reward: (Card | UpgradeKey)[] = this.game.pool.discover(
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
        )[0].name
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
      await this.post('post-sell', {
        ...refC(card),
        pos,
      })
    }
    await card.clear_desc()
    this.game.pool.drop(card.data.occupy.map(getCard))
    if (doPost) {
      await this.post('card-selled', {
        ...refP(this),
        target: card,
        flag: false,
        pos,
      })
      await this.obtain_resource({
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
      await this.post('post-enter', refC(card))
    }
    await card.clear_desc()
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
      this.insertResolve = (v: number) => {
        this.game
          .postOutput('end-insert', {
            client,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.postOutput('begin-insert', {
        client,
      })
    })
  }

  async queryDiscover(item: (Card | UpgradeKey)[], cancel: boolean) {
    const client = this.pos
    return new Promise<number>(resolve => {
      this.discoverResolve = (v: number) => {
        this.game
          .postOutput('end-discover', {
            client,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.postOutput('begin-discover', {
        client,
        item,
        cancel,
      })
    })
  }

  async queryDeploy() {
    const client = this.pos
    return new Promise<number>(resolve => {
      this.deployResolve = (v: number) => {
        this.game
          .postOutput('end-deploy', {
            client,
          })
          .then(() => {
            resolve(v)
          })
      }
      this.game.postOutput('begin-deploy', {
        client,
      })
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
    if (this.data.selected === 'none') {
      return null
    }
    const m = /^([HSP])(\d)$/.exec(this.data.selected)
    if (!m) {
      return null
    }
    switch (m[1]) {
      case 'H':
        return this.data.hand[Number(m[2])]
      case 'S':
        return this.data.store[Number(m[2])]
      case 'P':
        return this.present[Number(m[2])]
    }
    return null
  }

  async do_refresh() {
    this.game.pool.drop(
      (this.data.store.filter(x => x !== null) as CardKey[]).map(getCard)
    )
    this.data.store.fill(null)
    this.fill_store()
    await this.post('refreshed', refP(this))
  }

  bind_inputs() {
    this.bus.on('$upgrade', async () => {
      if (this.data.level < 6 && this.data.mineral >= this.data.upgrade_cost) {
        this.data.mineral -= this.data.upgrade_cost
        this.data.level += 1
        this.data.upgrade_cost = this.data.config.UpgradeCost[this.data.level]
        if (
          this.data.store.length < this.data.config.StoreCount[this.data.level]
        ) {
          this.data.store.push(null)
        }
        await this.post('tavern-upgraded', {
          ...refP(this),
          level: this.data.level,
        })
      }
    })
    this.bus.on('$refresh', async () => {
      if (this.data.mineral < this.role.refresh_cost()) {
        return
      }
      this.data.mineral -= this.role.refresh_cost()
      await this.do_refresh()

      await this.role.refreshed()
    })
    this.bus.on('$done', async () => {
      this.data.doned = true
      await this.game.add_done()
    })
    this.bus.on('$ability', async () => {
      if (!this.data.ability.enable) {
        return
      }
      await this.role.ability()
    })
    this.bus.on('$lock', async () => {
      this.data.locked = true
    })
    this.bus.on('$unlock', async () => {
      this.data.locked = false
    })
    this.bus.on('$select', async ({ choice }) => {
      this.data.selected = choice
      await this.game.postOutput('selected', {
        choice,
        client: this.pos,
      })
    })
    this.bus.on('$insert-choice', async ({ choice }) => {
      if (this.insertResolve) {
        this.insertResolve(choice)
      }
    })
    this.bus.on('$deploy-choice', async ({ choice }) => {
      if (this.deployResolve) {
        this.deployResolve(choice)
      }
    })
    this.bus.on('$discover-choice', async ({ choice }) => {
      if (this.discoverResolve) {
        this.discoverResolve(choice)
      }
    })
    this.bus.on('$buy-enter', async ({ place }) => {
      const ck = this.data.store[place]
      if (!ck || !this.can_buy(ck, 'enter') || !this.can_enter(ck)) {
        return
      }
      this.data.mineral -= this.role.buy_cost(ck, 'enter')
      await this.enter(getCard(ck))
      this.data.store[place] = null

      await this.role.bought()
    })
    this.bus.on('$buy-cache', async ({ place }) => {
      const ck = this.data.store[place]
      if (!ck || !this.can_buy(ck, 'cache') || !this.can_cache()) {
        return
      }
      this.data.mineral -= this.role.buy_cost(ck, 'cache')
      this.data.hand[this.data.hand.findIndex(v => v === null)] = ck
      this.data.store[place] = null

      await this.role.bought()
    })
    this.bus.on('$buy-combine', async ({ place }) => {
      const ck = this.data.store[place]
      if (!ck || !this.can_buy(ck, 'combine') || !this.can_combine(ck)) {
        return
      }
      this.data.mineral -= this.role.buy_cost(ck, 'combine')
      await this.combine(getCard(this.data.store[place] as CardKey))
      this.data.store[place] = null

      // await this.role.bought()
    })
    this.bus.on('$hand-enter', async ({ place }) => {
      const ck = this.data.hand[place]
      if (!ck || !this.can_enter(ck)) {
        return
      }
      this.data.hand[place] = null
      await this.enter(getCard(ck))
    })
    this.bus.on('$hand-combine', async ({ place }) => {
      const ck = this.data.hand[place]
      if (!ck || !this.can_combine(ck)) {
        return
      }
      this.data.hand[place] = null
      await this.combine(getCard(ck))
    })
    this.bus.on('$hand-sell', async ({ place }) => {
      if (!this.data.hand[place]) {
        return
      }
      this.data.hand[place] = null
      await this.obtain_resource({
        mineral: 1,
      })
    })
    this.bus.on('$present-upgrade', async ({ place }) => {
      if (
        !this.present[place] ||
        !this.can_pres_upgrade((this.present[place] as CardInstance).data)
      ) {
        return
      }

      const c = this.present[place] as CardInstance
      if (c.data.upgrades.length >= this.data.config.MaxUpgradePerCard) {
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
      await this.obtain_resource({
        gas: -2,
      })
      if (
        !(await this.discover(
          item.map(u => u.name),
          {
            target: c,
            cancel: true,
          }
        ))
      ) {
        await this.obtain_resource({
          gas: 1,
        })
      }
    })
    this.bus.on('$present-sell', async ({ place }) => {
      if (!this.present[place]) {
        return
      }
      await this.sell(this.present[place] as CardInstance)
    })
    this.bus.on('$obtain-card', async ({ card }) => {
      if (this.data.hand.filter(x => x).length === 6) {
        return
      }
      this.data.hand[this.data.hand.findIndex(v => v === null)] = card
    })
    this.bus.on('$obtain-unit', async ({ place, units }) => {
      if (!this.data.present[place]) {
        return
      }
      this.present[place]?.obtain_unit(units)
    })
    this.bus.on('$imr', async () => {
      await this.obtain_resource({
        mineral: 100,
        gas: 100,
      })
    })
  }

  bind_default() {
    this.bus.on('round-start', async () => {
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
      if (!this.data.locked) {
        this.game.pool.drop(
          (this.data.store.filter(x => x !== null) as CardKey[]).map(getCard)
        )
        this.data.store.fill(null)
      }
      this.data.locked = false
      this.fill_store()
    })
    this.bus.on('card-selled', async ({ target }) => {
      if (target.data.race === 'N') {
        // 检查尖塔
        for (const c of this.present.filter(isCardInstance)) {
          await c.obtain_unit(
            us('原始异龙', c.data.upgrades.filter(u => u === '原始尖塔').length)
          )
        }
      }
    })
  }

  can_buy(ck: CardKey, act: 'enter' | 'combine' | 'cache') {
    return this.data.mineral >= this.role.buy_cost(ck, act)
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

  can_cache() {
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
