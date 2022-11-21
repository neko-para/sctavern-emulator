import {
  AllCard,
  AllUpgrade,
  Card,
  CardKey,
  getCard,
  getUpgrade,
  UnitKey,
  UpgradeKey,
} from 'data'
import { CardInstance } from './card'
import { Descriptors } from './descriptor'
import { Emitter } from './emitter'
import { Game } from './game'
import { Descriptor, LogicBus, PlayerConfig } from './types'
import { isCardInstance, isNotCardInstance, refC, refP } from './utils'

interface PlayerAttrib {
  level: number
  upgrade_cost: number

  mineral: number
  gas: number
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
      gas: -1,
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
    }

    this.insertResolve = null
    this.discoverResolve = null

    this.bind_inputs()
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
  ): Promise<boolean> {
    const choice = await this.queryDiscover(item, !!option?.cancel)
    if (choice === -1) {
      return false
    }
    const cho = item[choice]
    if (AllCard.includes(cho as CardKey)) {
      await this.obtain_card(getCard(cho as CardKey))
    } else {
      await option?.target?.obtain_upgrade(cho as UpgradeKey)
    }
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
    }
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
      egg_card = new CardInstance(this, getCard('虫卵'))
      await this.put(egg_card, hole)
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
    data.sort((a, b) => {
      if (a.desc.gold === b.desc.gold) {
        return a.card.pos - b.card.pos
      } else {
        return a.desc.gold ? -1 : 1
      }
    })
    data[0].desc.disabled = false
    data.slice(1).forEach(({ desc }) => {
      desc.disabled = true
    })
    await this.refresh()
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
        this.present[p] = this.present[p - 1]
        ;(this.present[p] as CardInstance).pos = p
      }
      this.present[pos] = card
      card.pos = pos
      return true
    }
    p = this.present.lastIndexOf(null)
    if (p !== -1) {
      for (let i = p; i < pos; i++) {
        this.present[p] = this.present[p + 1]
        ;(this.present[p] as CardInstance).pos = p
      }
      this.present[pos] = card
      card.pos = pos
      return true
    }
    return false
  }

  async put(card: CardInstance, pos: number) {
    if (await this._put(card, pos)) {
      await this.refresh()
      return true
    } else {
      return false
    }
  }

  async unput(card: CardInstance) {
    this.present[card.pos] = null
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
    this.put(card, pos)

    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        await card.add_desc(descs[i], cardt.desc[i])
      }
    }

    await this.post('card-entered', {
      ...refP(this),
      target: card,
    })

    await this.post('post-enter', {
      ...refC(card),
    })

    return true
  }

  async combine(cardt: Card) {
    const cs = this.find_name(cardt.name).filter(c => c.data.color === 'normal')
    if (cs.length < 2) {
      return false
    }

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

    const reward: (CardKey | UpgradeKey)[] = this.game.pool
      .discover(c => c.level === Math.min(6, this.data.level + 1), 3, true)
      .map(c => c.name)
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
    this.unput(card)
    await this.post('post-sell', refC(card))
    await card.clear_desc()
    // 这里存在破坏replay顺序的隐患, 如果在服务器端并发执行所有的input, 会导致pool内内容不确定
    this.game.pool.drop(card.occupy.map(getCard))
    await this.post('card-selled', {
      ...refP(this),
      target: card,
    })
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

  async queryDiscover(item: (CardKey | UpgradeKey)[], cancel: boolean) {
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
      await this.post('refreshed', refP(this))
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
  }
}
