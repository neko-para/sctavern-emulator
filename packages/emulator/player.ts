import {
  AllCard,
  AllUpgrade,
  Card,
  CardKey,
  getCard,
  getUpgrade,
  Race,
  UnitKey,
  Upgrade,
  UpgradeKey,
} from 'data'
import { AttributeManager } from './attribute'
import { CardInstance } from './card'
import { Descriptors } from './descriptor'
import { Emitter } from './emitter'
import { Game } from './game'
import { Descriptor, LogicBus, PlayerConfig } from './types'
import { isCardInstance, isNotCardInstance, refC, refP, us } from './utils'

interface PlayerAttrib {
  level: number
  upgrade_cost: number

  mineral: number
  mineral_max: number
  gas: number

  locked: boolean

  attrib: AttributeManager
  persisAttrib: AttributeManager
}

interface UniqueDescInfo {
  card: CardInstance
  desc: Descriptor
}

export class Player {
  bus: Emitter<LogicBus>
  game: Game
  pos: number

  data: PlayerAttrib

  store: (CardKey | null)[]
  hand: (CardKey | null)[]
  present: (CardInstance | null)[]

  unique: Record<string, UniqueDescInfo[]> // 唯一

  config: PlayerConfig

  insertResolve: ((v: number) => void) | null
  discoverResolve: ((v: number) => void) | null

  constructor(game: Game, pos: number) {
    this.bus = new Emitter('card', [])
    this.game = game
    this.pos = pos
    this.data = {
      level: 1,
      upgrade_cost: 6,
      mineral: 0,
      mineral_max: 2,
      gas: -1,
      locked: false,

      attrib: new AttributeManager(() => this.refresh()),
      persisAttrib: new AttributeManager(() => this.refresh()),
    }

    this.store = Array(3).fill(null)
    this.hand = Array(6).fill(null)
    this.present = Array(7).fill(null)

    this.unique = {}

    this.config = {
      MaxUnitPerCard: 200,
      MaxUpgradePerCard: 5,
      AlwaysInsert: false,

      StoreCount: [0, 3, 4, 4, 5, 5, 6],
      UpgradeCost: [0, 5, 7, 8, 9, 11, 0],

      MaxMineral: 10,
      MaxGas: 6,
    }

    this.insertResolve = null
    this.discoverResolve = null

    this.bind_inputs()
    this.bind_default()
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

  value(): number {
    return this.present
      .filter(isCardInstance)
      .map(c => c.value())
      .reduce((a, b) => a + b, 0)
  }

  first_hole(): number {
    const place = this.present
      .map((c, i) => [c, i] as [CardInstance, number])
      .filter(([c]) => isNotCardInstance(c))
      .map(([c, i]) => i)
    return place.length > 0 ? place[0] : -1
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
    this.game.pool.drop(item.filter(i => typeof i !== 'string') as Card[])
    return true
  }

  async obtain_resource(resource: { mineral?: number; gas?: number }) {
    this.data.mineral += resource.mineral || 0
    this.data.gas += resource.gas || 0
    await this.refresh()
  }

  async obtain_card(cardt: Card) {
    const idx = this.hand.findIndex(x => x === null)
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
      this.hand[idx] = cardt.name
      await this.refresh()
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
    for (const c of [from.left(), from.right()]) {
      if (c?.data.race === 'Z') {
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
      const hole = this.first_hole()
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
        return a.card.pos - b.card.pos
      } else {
        return a.desc.gold ? -1 : 1
      }
    })
    data[0].desc.disabled = false
    data.slice(1).forEach(({ desc: d }) => {
      d.disabled = true
    })
    await this.refresh()
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
    await this.refresh()
  }

  private async _put(card: CardInstance, pos: number) {
    if (pos === -1) {
      return false
    }
    let p = this.present.indexOf(null, pos)
    if (p !== -1) {
      for (let i = p; i > pos; i--) {
        this.present[i] = this.present[i - 1]
        ;(this.present[i] as CardInstance).pos = i
      }
      this.present[pos] = card
      card.pos = pos
      return true
    }
    p = this.present.lastIndexOf(null)
    if (p !== -1) {
      for (let i = p; i < pos; i++) {
        this.present[i] = this.present[i + 1]
        ;(this.present[i] as CardInstance).pos = i
      }
      this.present[pos] = card
      card.pos = pos
      return true
    }
    return false
  }

  async put(card: CardInstance, pos: number) {
    if (await this._put(card, pos)) {
      for (let i = 0; i < 7; i++) {
        this.bus.child[i] = this.present[i]?.bus || null
      }
      await this.refresh()
      return true
    } else {
      return false
    }
  }

  async unput(card: CardInstance) {
    this.present[card.pos] = null
    this.bus.child[card.pos] = null
  }

  async enter(cardt: Card) {
    let pos = this.first_hole()
    if (pos === -1) {
      return false
    }
    if (cardt.attr.insert || this.config.AlwaysInsert) {
      pos = await this.queryInsert()
    }
    const card = new CardInstance(this, cardt)
    card.occupy.push(cardt.name)
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

    return true
  }

  async combine(cardt: Card) {
    const cs = this.find_name(cardt.name).filter(c => c.data.color === 'normal')
    if (cs.length < 2) {
      return false
    }

    cs[0].data.color = 'gold'

    if (cardt.race === 'T') {
      const i1 = cs[0].infr()
      const i2 = cs[1].infr()
      if (i1[0] !== 'hightech' && i2[0] === 'hightech') {
        cs[0].data.units[i1[1]] = '高级科技实验室'
      }
      cs[1].data.units.splice(i2[1], 1)
    }
    cs[0].data.units = cs[0].data.units
      .concat(cs[1].data.units)
      .slice(0, this.config.MaxUnitPerCard)

    cs[1].data.upgrades.forEach(uk => {
      const u = getUpgrade(uk)
      if (!u.override && cs[0].data.upgrades.indexOf(uk) !== -1) {
        return
      }
      cs[0].data.upgrades.push(uk)
    })

    cs[0].data.upgrades = cs[0].data.upgrades.slice(
      0,
      this.config.MaxUpgradePerCard
    )

    for (const ak of new Set([
      ...Object.keys(cs[0].data.attrib.attrib),
      ...Object.keys(cs[1].data.attrib.attrib),
    ])) {
      const desc0 = cs[0].data.attrib.attrib[ak]
      const desc1 = cs[1].data.attrib.attrib[ak]
      const desc = desc0 || desc1
      switch (desc.policy) {
        case 'add':
          desc.value = (desc0?.value || 0) + (desc1?.value || 0)
          break
        case 'max':
          desc.value = Math.max(desc0?.value || 0, desc1?.value || 0)
          break
        case 'discard':
          desc.value = 0
          break
      }
      cs[0].data.attrib.attrib[ak] = desc
    }

    // TODO: 解决献祭的问题, 比如高建国夺取女王

    cs[0].occupy.push(...cs[1].occupy, cardt.name)

    await cs[0].clear_desc()
    await cs[1].clear_desc()

    await this.unput(cs[1])

    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        await cs[0].add_desc(descs[i], cardt.desc[i])
      }
    }

    if (cs[1].data.attrib.getAttribute('void')) {
      cs[0].data.attrib.setAttribute('void', 1)
    }

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
    if (cs[0].data.upgrades.length < this.config.MaxUpgradePerCard) {
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
    const dark = card.data.name === '虫卵' ? 0 : card.data.level >= 4 ? 2 : 1
    this.unput(card)
    await this.post('post-sell', refC(card, true))
    await card.clear_desc()
    this.game.pool.drop(card.occupy.map(getCard))
    await this.post('card-selled', {
      ...refP(this),
      target: card,
      flag: false,
    })
    await this.obtain_resource({
      mineral: 1,
    })
    for (const c of around) {
      await c.gain_darkness(dark)
    }
  }

  async destroy(card: CardInstance) {
    const around = card.around()
    const dark = card.data.name === '虫卵' ? 0 : card.data.level >= 4 ? 2 : 1
    this.unput(card)
    await card.clear_desc()
    this.game.pool.drop(card.occupy.map(getCard))
    await this.post('card-destroyed', {
      ...refP(this),
      target: card,
    })
    for (const c of around) {
      await c.gain_darkness(dark)
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

  private fill_store() {
    const nf = this.store.filter(c => !c).length
    const nc = this.game.pool.discover(
      card => card.level <= this.data.level,
      nf
    )
    for (let i = 0; i < this.store.length; i++) {
      if (!this.store[i]) {
        this.store[i] = nc.shift()?.name || null
      }
    }
  }

  bind_inputs() {
    this.bus.on('$upgrade', async () => {
      if (this.data.level < 6 && this.data.mineral >= this.data.upgrade_cost) {
        this.data.mineral -= this.data.upgrade_cost
        this.data.level += 1
        this.data.upgrade_cost = this.config.UpgradeCost[this.data.level]
        if (this.store.length < this.config.StoreCount[this.data.level]) {
          this.store.push(null)
        }
        await this.post('tavern-upgraded', {
          ...refP(this),
          level: this.data.level,
        })
        await this.refresh()
      }
    })
    this.bus.on('$refresh', async () => {
      if (this.data.mineral < 1) {
        return
      }
      this.data.mineral -= 1
      this.game.pool.drop(
        (this.store.filter(x => x !== null) as CardKey[]).map(getCard)
      )
      this.store.fill(null)
      this.fill_store()
      await this.post('refreshed', refP(this))
      await this.refresh()
    })
    this.bus.on('$done', async () => {
      // TODO: wait all done
      await this.game.next_round()
    })
    this.bus.on('$lock', async () => {
      this.data.locked = true
      await this.refresh()
    })
    this.bus.on('$unlock', async () => {
      this.data.locked = false
      await this.refresh()
    })
    this.bus.on('$insert-choice', async ({ choice }) => {
      if (this.insertResolve) {
        this.insertResolve(choice)
      }
    })
    this.bus.on('$discover-choice', async ({ choice }) => {
      if (this.discoverResolve) {
        this.discoverResolve(choice)
      }
    })
    this.bus.on('$buy-enter', async ({ place }) => {
      if (!this.store[place] || !this.can_buy_enter()) {
        return
      }
      this.data.mineral -= 3
      await this.enter(getCard(this.store[place] as CardKey))
      this.store[place] = null
      await this.refresh()
    })
    this.bus.on('$buy-cache', async ({ place }) => {
      if (!this.store[place] || !this.can_buy_cache()) {
        return
      }
      this.data.mineral -= 3
      this.hand[this.hand.findIndex(v => v === null)] = this.store[place]
      this.store[place] = null
      await this.refresh()
    })
    this.bus.on('$buy-combine', async ({ place }) => {
      if (
        !this.store[place] ||
        !this.can_buy_combine(this.store[place] as CardKey)
      ) {
        return
      }
      this.data.mineral -= 3
      await this.combine(getCard(this.store[place] as CardKey))
      this.store[place] = null
      await this.refresh()
    })
    this.bus.on('$hand-enter', async ({ place }) => {
      if (!this.hand[place] || !this.can_hand_enter()) {
        return
      }
      const c = this.hand[place] as CardKey
      this.hand[place] = null
      await this.enter(getCard(c))
      await this.refresh()
    })
    this.bus.on('$hand-combine', async ({ place }) => {
      if (
        !this.hand[place] ||
        !this.can_hand_combine(this.hand[place] as CardKey)
      ) {
        return
      }
      const c = this.hand[place] as CardKey
      this.hand[place] = null
      await this.combine(getCard(c))
      await this.refresh()
    })
    this.bus.on('$hand-sell', async ({ place }) => {
      if (!this.hand[place]) {
        return
      }
      this.hand[place] = null
      await this.obtain_resource({
        mineral: 1,
      })
    })
    this.bus.on('$present-upgrade', async ({ place }) => {
      if (
        !this.present[place] &&
        this.can_pres_upgrade(this.present[place] as CardInstance)
      ) {
        return
      }

      const c = this.present[place] as CardInstance
      if (c.data.upgrades.length >= this.config.MaxUpgradePerCard) {
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
      if (!this.can_buy_cache()) {
        return
      }
      this.hand[this.hand.findIndex(v => v === null)] = card
      await this.refresh()
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
      this.data.attrib = new AttributeManager(() => this.refresh())
      if (this.data.upgrade_cost > 0) {
        this.data.upgrade_cost -= 1
      }
      if (this.data.mineral_max < this.config.MaxMineral) {
        this.data.mineral_max += 1
      }
      this.data.mineral = this.data.mineral_max
      if (this.data.gas < this.config.MaxGas) {
        this.data.gas += 1
      }
      if (!this.data.locked) {
        this.store.fill(null)
      }
      this.data.locked = false
      this.fill_store()
      await this.refresh()
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

  can_buy_enter() {
    return (
      this.data.mineral >= 3 &&
      this.present.filter(isNotCardInstance).length > 0
    )
  }

  can_buy_cache() {
    return this.data.mineral >= 3 && this.hand.filter(x => x).length < 6
  }

  can_buy_combine(ck: CardKey) {
    return this.data.mineral >= 3 && this.can_hand_combine(ck)
  }

  can_hand_enter() {
    return this.present.filter(isNotCardInstance).length > 0
  }

  can_hand_combine(ck: CardKey) {
    return this.find_name(ck).filter(c => c.data.color === 'normal').length >= 2
  }

  can_pres_upgrade(c: CardInstance) {
    return (
      c.data.upgrades.length < this.config.MaxUpgradePerCard &&
      this.data.gas >= 2
    )
  }

  can_tavern_upgrade() {
    return this.data.level < 6 && this.data.mineral >= this.data.upgrade_cost
  }

  can_refresh() {
    return this.data.mineral >= 1
  }
}
