import { computed, reactive } from '@vue/reactivity'
import {
  AllCard,
  AllUpgrade,
  CardKey,
  getCard,
  getRole,
  getUnit,
  getUpgrade,
  isBiological,
  isHero,
  isMachine,
  isNormal,
  Role,
  RoleKey,
  royalized,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance, CardInstanceAttrib } from './card'
import { Player, StoreStatus } from './player'
import {
  autoBind,
  isCardInstance,
  isCardInstanceAttrib,
  mostValueUnit,
  refP,
  us,
} from './utils'
import { Descriptors } from './descriptor'
import { RenewPolicy, 任务, 反应堆 } from './descriptor/terran'
import { DescriptorGenerator, MutationKey } from './types'

export interface RoleData {
  data: Role
  prog_cur: number
  prog_max: number
  enable: boolean
  enpower: boolean
  extra?: string[]
}

interface IRole {
  player: Player
  data: RoleData

  ability(): Promise<void>

  buy_cost(
    card: CardKey,
    act: 'enter' | 'combine' | 'cache',
    pos: number
  ): number
  refresh_cost(): number

  bought(pos: number): Promise<void>
  refreshed(): Promise<void>
}

interface RoleBind {
  (role: IRole): void | (() => Promise<void>)
}

export class RoleImpl implements IRole {
  player: Player
  data: RoleData

  ability: () => Promise<void>

  buy_cost: (
    card: CardKey,
    act: 'enter' | 'combine' | 'cache',
    pos: number
  ) => number
  refresh_cost: () => number

  bought: (pos: number) => Promise<void>
  refreshed: () => Promise<void>

  constructor(p: Player, b: RoleBind, r: Role) {
    this.player = p
    this.data = reactive({
      data: r,
      prog_cur: -1,
      prog_max: -1,
      enable: false,
      enpower: false,
    })

    this.buy_cost = () => 3
    this.refresh_cost = () => 1

    this.bought = async () => {
      //
    }
    this.refreshed = async () => {
      //
    }

    this.ability =
      b(this) ||
      (async () => {
        //
      })
  }
}

function ActPerRound(
  r: IRole,
  c: number,
  a: (r: IRole) => Promise<boolean>,
  e: (r: IRole) => boolean = () => true
) {
  r.data.prog_max = c
  r.player.bus.on('round-enter', async () => {
    r.data.prog_cur = c
  })
  r.data.enable = computed(() => {
    return r.data.prog_cur > 0 && e(r)
  }) as unknown as boolean

  return async () => {
    if (await a(r)) {
      r.data.prog_cur -= 1
    }
  }
}

function ExpectSelected(
  role: IRole,
  pred: (card: CardInstance) => boolean = () => true
): CardInstance | null {
  const sel = role.player.current_selected()
  if (!(sel instanceof CardInstance)) {
    return null
  }
  return pred(sel) ? sel : null
}

function 白板() {
  return async () => {
    //
  }
}

function 执政官(r: IRole) {
  return ActPerRound(r, 1, async role => {
    const left = ExpectSelected(role)
    const right = left?.right()
    if (
      !left ||
      !right ||
      left.data.race === right.data.race ||
      left.data.color !== 'normal' ||
      right.data.color !== 'normal'
    ) {
      return false
    }
    const leftBinds = left.data.descriptors
    right.data.name = `${right.data.name}x${left.data.name}`
    if (right.data.race === 'N') {
      right.data.race = left.data.race
    } else if (left.data.race !== 'N') {
      right.data.race = 'N'
    }
    right.data.occupy.push(...left.data.occupy)
    await right.seize(left, {
      unreal: true,
      upgrade: true,
    })
    right.data.color = 'darkgold'
    right.data.belong = 'none'
    for (const b of leftBinds) {
      right.bind_desc(b.bind, b.text, b.data)
    }
    right.attrib.cleanView()
    right.bindDef()
    return true
  })
}

function 陆战队员(r: IRole) {
  return ActPerRound(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 2) {
        return false
      }
      const tl = Math.max(1, role.player.data.level - 1)
      role.player.obtain_resource({
        mineral: -2,
      })
      await role.player.discover(
        role.player.game.pool.discover(c => c.level === tl, 2)
      )
      return true
    },
    role => role.player.data.mineral >= 2
  )
}

function 收割者(r: IRole) {
  r.player.data.config.AlwaysInsert = true
  r.buy_cost = c => (getCard(c).attr.insert ? 2 : 3)
}

function 感染虫(r: IRole) {
  return ActPerRound(r, 1, async role => {
    const card = ExpectSelected(role, card => card.data.race === 'T')
    if (!card) {
      return false
    }
    const infr = card.data.infr
    if (infr[0] === 'reactor') {
      card.remove_unit([infr[1]])
    }
    card.data.color = 'darkgold'
    card.data.race = 'Z'
    card.data.name = `被感染的${card.data.name}`
    await card.clear_desc()
    card.add_desc(
      autoBind('round-end', async card => {
        await role.player.inject(card.data.units.filter(isNormal).slice(0, 1))
      }),
      ['每回合结束时注卵随机一个单位', '每回合结束时注卵随机一个单位']
    )
    return true
  })
}

function SCV(r: IRole) {
  return ActPerRound(r, 1, async role => {
    const card = ExpectSelected(
      role,
      card => card.data.race === 'T' && card.data.infr[0] === 'hightech'
    )
    if (!card) {
      return false
    }
    await card.switch_infr()
    return true
  })
}

function 阿巴瑟(r: IRole) {
  return ActPerRound(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 2) {
        return false
      }
      const card = ExpectSelected(role)
      if (!card) {
        return false
      }
      const tl = Math.min(6, card.data.level + 1)
      role.player.obtain_resource({
        mineral: -2,
      })
      await role.player.destroy(card)
      await role.player.discover(
        role.player.game.pool.discover(c => c.level === tl, 3)
      )
      return true
    },
    role => role.player.data.mineral >= 2
  )
}

function 工蜂(r: IRole) {
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round % 2 === 1) {
      if (r.player.data.gas < 6) {
        r.player.obtain_resource({
          gas: 1,
        })
      }
    } else {
      r.player.obtain_resource({
        mineral: 1,
      })
    }
  })
}

function 副官(r: IRole) {
  r.data.prog_max = 1
  r.refresh_cost = () => {
    return r.data.prog_cur > 0 ? 0 : 1
  }
  r.player.bus.on('round-enter', async () => {
    r.data.prog_cur = 1
    if (r.player.persisAttrib.get('R副官')) {
      r.player.obtain_resource({
        mineral: 1,
      })
    }
  })
  r.player.bus.on('round-end', async () => {
    r.player.persisAttrib.config('R副官', r.player.data.mineral)
  })
  r.refreshed = async () => {
    if (r.data.prog_cur > 0) {
      r.data.prog_cur -= 1
    }
  }
}

function 追猎者(r: IRole) {
  r.data.prog_max = 5
  r.player.persisAttrib.config('R追猎者', 0)
  r.bought = async () => {
    if (r.data.enpower || !r.player.attrib.get('R追猎者')) {
      r.player.attrib.config('R追猎者', 1)
      await r.player.do_refresh()
    }
  }
  r.player.bus.on('round-enter', async () => {
    if (!r.data.enpower) {
      r.data.prog_cur = 0
    }
  })
  r.refreshed = async () => {
    if (!r.data.enpower && r.data.prog_cur < r.data.prog_max) {
      r.data.prog_cur += 1
      if (r.data.prog_cur === r.data.prog_max) {
        r.data.enpower = true
      }
    }
  }
}

function 使徒(r: IRole) {
  r.data.prog_max = 2
  r.bought = async () => {
    if (r.data.prog_cur === -1) {
      return
    }
    if (r.data.prog_cur < r.data.prog_max) {
      r.data.prog_cur += 1
      if (r.data.prog_cur === r.data.prog_max) {
        r.data.enpower = true
      }
    } else if (r.data.prog_cur === r.data.prog_max) {
      r.data.prog_cur = -1
      r.data.enpower = false
    }
  }
  r.buy_cost = (ck, act) => {
    return r.data.enpower && act !== 'combine' ? 1 : 3
  }
  r.player.bus.on('round-start', async () => {
    r.data.prog_cur = 0
  })
}

function 矿骡(r: IRole) {
  r.player.bus.on('round-enter', async () => {
    if (r.player.persisAttrib.get('R矿骡')) {
      r.data.enable = false
      r.player.obtain_resource({
        mineral: 2 - r.player.data.mineral_max,
      })
      r.player.persisAttrib.config('R矿骡', 0)
    } else {
      r.data.enable = true
    }
  })
  return async () => {
    r.player.persisAttrib.config('R矿骡', 1)
    r.data.enable = false
    r.player.obtain_resource({
      mineral: Math.max(0, r.player.data.mineral_max - r.player.data.mineral),
    })
  }
}

function 斯台特曼(r: IRole) {
  r.player.bus.on('card-entered', async ({ target }) => {
    await r.player.discover(
      r.player.game.shuffle(AllUpgrade.filter(x => x !== '献祭')).slice(0, 3),
      {
        target,
      }
    )
  })
  r.player.bus.on('tavern-upgraded', async () => {
    r.player.obtain_resource({
      gas: 1,
    })
  })
  r.player.bus.on('round-start', async ({ round }) => {
    if (round > 1) {
      r.player.obtain_resource({
        gas: -1,
      })
    }
  })
}

function 雷诺(r: IRole) {
  r.data.enable = true

  return async () => {
    const card = ExpectSelected(
      r,
      card => card.data.color === 'normal' && card.data.level < 6
    )
    if (!card) {
      return
    }
    card.data.color = 'gold'
    const descs = card.data.descriptors
    await card.clear_desc()
    for (const d of descs) {
      card.add_desc(d.data.desc, d.data.text)
    }
    await card.obtain_upgrade('金光闪闪')
    r.data.enable = false
  }
}

function 阿塔尼斯(r: IRole) {
  r.data.prog_max = 9
  r.data.prog_cur = 0
  r.player.bus.on('card-entered', async ({ target }) => {
    if (r.data.prog_cur === -1) {
      return
    }
    if (target.data.race !== 'P') {
      return
    }
    r.data.prog_cur += 1
    if (r.data.prog_cur === r.data.prog_max) {
      r.data.prog_cur = -1
      const cardt = getCard('阿塔尼斯')
      const units: UnitKey[] = []
      for (const k in cardt.unit) {
        units.push(...Array(cardt.unit[k as UnitKey]).fill(k))
      }
      await target.obtain_unit(units)

      const descs = Descriptors[cardt.name]
      if (descs) {
        for (let i = 0; i < descs.length; i++) {
          target.add_desc(descs[i], cardt.desc[i])
        }
      } else {
        console.log('WARN: Card Not Implement Yet')
      }

      target.data.name = '大主教的卫队'
      target.data.color = 'darkgold'
    }
  })
}

function 科学球(r: IRole) {
  const record = reactive<Partial<Record<UnitKey, number>>>({})
  r.data.prog_max = 2
  r.data.prog_cur = 2
  r.data.enable = computed<boolean>(
    () =>
      r.player.data.gas >= 1 &&
      !r.player.attrib.get('R科学球') &&
      r.data.prog_cur > 0
  ) as unknown as boolean
  r.data.extra = computed<string[]>(() => {
    return (Object.keys(record) as UnitKey[]).map(k => `${k}: ${record[k]}`)
    // .join('\n')
  }) as unknown as string[]
  r.player.bus.on('card-entered', async ({ target }) => {
    const [unit] = mostValueUnit(target.data.units)
    if (unit) {
      record[unit] = (record[unit] || 0) + 1
    }
  })
  return async () => {
    if (
      !r.player.can_enter('观察样本') ||
      r.player.data.gas < 1 ||
      r.player.attrib.get('R科学球') ||
      r.data.prog_cur === 0
    ) {
      return
    }
    r.data.prog_cur -= 1
    r.player.obtain_resource({
      gas: -1,
    })
    r.player.attrib.config('R科学球', 1)
    const c = await r.player.enter(getCard('观察样本'))
    await c?.obtain_unit(
      (Object.keys(record) as UnitKey[]).map(k => us(k, record[k] || 0)).flat(1)
    )
  }
}

function 母舰核心(r: IRole) {
  r.data.prog_max = 2
  r.data.prog_cur = 0
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round === 1) {
      r.player.obtain_resource({
        mineral: -3,
      })
      await r.player.enter(getCard('母舰核心'))
    }
  })
  r.player.bus.on('card-combined', async () => {
    const cs = r.player.find_name(r.data.enpower ? '母舰' : '母舰核心')
    const c = cs.length > 0 ? cs[0] : null
    if (r.data.prog_cur < r.data.prog_max && r.data.prog_cur !== -1) {
      r.data.prog_cur += 1
      if (r.data.prog_cur === r.data.prog_max) {
        r.data.enpower = true
        r.data.prog_cur = -1
        if (c) {
          c.data.name = '母舰'
          c.replace_unit(c.find('母舰核心', 1), '母舰')
        }
      }
    }
    if (c) {
      await c.obtain_unit(us('虚空辉光舰', r.player.data.level))
    }
  })
}

function 行星要塞(r: IRole) {
  r.player.bus.on('card-entered', async ({ target }) => {
    if (target.data.belong === 'building') {
      await target.obtain_unit(us('自动机炮', target.player.data.level + 1))
    }
  })
  return ActPerRound(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 3) {
        return false
      }
      role.player.obtain_resource({
        mineral: -3,
      })
      await role.player.discover(
        role.player.game
          .shuffle(AllCard.map(getCard).filter(c => c.attr.type === 'building'))
          .slice(0, 3),
        {
          nodrop: true,
        }
      )
      return true
    },
    role => role.player.data.mineral >= 3
  )
}

function 拟态虫(r: IRole) {
  return ActPerRound(
    r,
    1,
    async role => {
      const card = ExpectSelected(
        role,
        card => card.data.pos !== role.player.persisAttrib.get('R拟态虫', -1)
      )
      if (!card) {
        return false
      }
      role.player.persisAttrib.config('R拟态虫', card.data.pos)
      role.player.obtain_resource({
        mineral: -2,
      })
      const cardt = role.player.game.shuffle(
        AllCard.map(getCard)
          .filter(c => c.level === role.player.data.level)
          .filter(c => role.player.game.pool.pack[c.pack])
      )[0]
      const units: UnitKey[] = []
      for (const u in cardt.unit) {
        const unit = u as UnitKey
        if (isNormal(unit)) {
          units.push(...us(unit, cardt.unit[unit] || 0))
        }
      }
      await card.obtain_unit(units)
      return true
    },
    role => role.player.data.mineral >= 2
  )
}

function 探机(r: IRole) {
  r.player.bus.on('card-entered', async ({ target }) => {
    await target.obtain_unit(['水晶塔'])
  })
  return ActPerRound(
    r,
    1,
    async role => {
      const card = ExpectSelected(role)
      if (!card) {
        return false
      }
      if (role.player.data.mineral < 1) {
        return false
      }
      const pos = card.find('水晶塔')
      if (pos.length === 0) {
        return false
      }
      role.player.obtain_resource({
        mineral: -1,
      })
      card.replace_unit(pos.slice(0, 1), '虚空水晶塔')
      return true
    },
    role => role.player.data.mineral >= 1
  )
}

function 泰凯斯(r: IRole) {
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round === 1) {
      if (r.player.data.mineral === 3) {
        // 考虑到存在作为辅助角色碰到母舰的情况
        r.player.obtain_resource({
          mineral: -3,
        })
      }
      const card = (await r.player.enter(getCard('不法之徒'))) as CardInstance
      let reactor: [DescriptorGenerator, [string, string]] | null = null
      const tasks: [DescriptorGenerator, string][] = [
        [
          任务('refreshed', 4, async card => {
            card.player.data.upgrade_cost = Math.max(
              0,
              card.player.data.upgrade_cost - 4
            )
            await card.obtain_unit(['反应堆'])
            card.data.level = 2
            reactor = [
              反应堆('陆战队员'),
              ['反应堆生产陆战队员', '反应堆生产陆战队员'],
            ]
            pop()
          }),
          '任务: 刷新4次酒馆\n奖励: 酒馆升级费用降低4并获得反应堆, 生产陆战队员',
        ],
        [
          任务('card-entered', 2, async card => {
            await card.obtain_unit(us('陆战队员', 4))
            card.data.level = 3
            pop()
          }),
          '任务: 进场2张卡牌\n奖励: 获得4个陆战队员',
        ],
        [
          任务('refreshed', 4, async card => {
            await card.obtain_upgrade('强化药剂')
            await card.player.discover(
              card.player.game.pool.discover(
                c => c.level === card.player.data.level,
                3
              )
            )
            card.data.level = 4
            pop()
          }),
          '任务: 刷新4次酒馆\n奖励: 获得强化药剂升级, 获得当前酒馆等级的卡牌',
        ],
        [
          任务('refreshed', 6, async card => {
            await card.player.discover(
              card.player.game.pool.discover(
                c => c.level === card.player.data.level,
                3
              )
            )
            card.data.level = 5
            reactor = [
              反应堆('陆战队员(精英)'),
              ['反应堆生产陆战队员(精英)', '反应堆生产陆战队员(精英)'],
            ]
            pop()
          }),
          '任务: 刷新6次酒馆\n奖励: 获得当前酒馆等级的卡牌, 反应堆生产陆战队员(精英)',
        ],
        [
          任务('card-entered', 4, async card => {
            card.player.obtain_resource({
              mineral: 4,
            })
            await card.obtain_unit(us('攻城坦克', 2))
            card.data.level = 6
            pop()
          }),
          '任务: 进场4张卡牌\n奖励: 获得4晶体矿和2攻城坦克',
        ],
        [
          任务('card-entered', 6, async card => {
            await card.obtain_unit(['奥丁'])
            card.data.level = 7
            pop()
          }),
          '任务: 进场6张卡牌\n奖励: 获得1奥丁',
        ],
        [
          任务(
            'card-entered',
            4,
            async card => {
              await card.obtain_unit(['雷神'])
            },
            () => true,
            RenewPolicy.instant
          ),
          '任务: 进场4张卡牌\n奖励: 获得1雷神',
        ],
      ]
      const pop = () => {
        const task = tasks.shift()
        if (task) {
          card.clear_desc()
          if (reactor) {
            card.add_desc(reactor[0], reactor[1])
          }
          card.add_desc(task[0], [task[1], task[1]])
        }
      }
      pop()
    }
  })
}

function 诺娃(r: IRole) {
  r.player.bus.on('round-enter', async () => {
    await r.player.discover(
      r.player.game
        .shuffle(AllCard.map(getCard).filter(c => c.attr.type === 'support'))
        .slice(0, 2)
    )
  })
}

function 思旺(r: IRole) {
  r.data.enable = true
  return async () => {
    const card = ExpectSelected(r, card => card.data.name !== '机械工厂')
    if (!card) {
      return
    }
    const n = card.filter(isMachine).length
    if (n === 0) {
      return
    }
    if (r.player.find_name('机械工厂').length === 0) {
      const c = (await r.player.enter(getCard('机械工厂'))) as CardInstance
      c.data.color = 'gold'
    }
    const c = r.player.find_name('机械工厂')[0]
    if (!c) {
      return
    }
    await c.obtain_unit(us('零件', n))
  }
}

function 跳虫() {
  //
}

function 蒙斯克(r: IRole) {
  r.data.prog_cur = 12
  r.player.bus.on('round-start', async () => {
    r.data.prog_cur = Math.max(0, r.data.prog_cur - 3)
  })
  r.data.enable = computed<boolean>(() => {
    return r.player.data.mineral >= r.data.prog_cur
  }) as unknown as boolean
  return async () => {
    if (r.player.data.mineral < r.data.prog_cur) {
      return
    }
    r.player.obtain_resource({
      mineral: -r.data.prog_cur,
    })
    r.data.prog_cur = 9
    for (const card of r.player.present.filter(isCardInstance)) {
      let idx = card.find('战列巡航舰', 1)
      if (idx.length > 0) {
        card.replace_unit(idx, royalized)
        continue
      }
      idx = card.find('雷神', 1)
      if (idx.length > 0) {
        card.replace_unit(idx, royalized)
        continue
      }
      idx = card.find('攻城坦克', 1)
      if (idx.length > 0) {
        card.replace_unit(idx, royalized)
        continue
      }
      idx = card.find(u => u === '维京战机' || u === '维京战机<机甲>', 1)
      if (idx.length > 0) {
        card.replace_unit(idx, royalized)
        continue
      }
    }
  }
}

function 雷神(r: IRole) {
  r.data.enable = true
  r.player.bus.on('tavern-upgraded', async () => {
    r.data.enable = true
  })
  return async () => {
    const card = ExpectSelected(r, card => card.data.level < 6)
    if (!card) {
      return
    }
    const items = r.player.game.shuffle(
      AllCard.map(getCard).filter(
        c =>
          c.name !== card.data.name &&
          c.level === card.data.level &&
          c.race === card.data.race &&
          c.pack === '核心' &&
          c.pool
      )
    )
    let choice = -1
    if (
      !(await r.player.discover(items, {
        cancel: true,
        fake: cho => {
          choice = cho
        },
      }))
    ) {
      return
    }
    const cardt = items[choice]

    card.clear_desc()
    const descs = Descriptors[cardt.name]
    if (descs) {
      for (let i = 0; i < descs.length; i++) {
        card.add_desc(descs[i], cardt.desc[i])
      }
    } else {
      console.log('WARN: Card Not Implement Yet')
    }

    await r.player.post('card-entered', {
      ...refP(r.player),
      target: card,
    })
    r.data.enable = false
  }
}

function 机械哨兵(r: IRole) {
  r.data.prog_max = 3
  r.data.prog_cur = 3
  r.player.bus.on('round-enter', async () => {
    if (r.data.prog_cur === 0) {
      r.player.attrib.config('R机械哨兵', 1)
    }
  })
  r.data.enable = computed(() => {
    return (
      !r.player.attrib.get('R机械哨兵') &&
      r.player.data.mineral >= 4 &&
      r.player.can_cache()
    )
  }) as unknown as boolean

  return async () => {
    const card = ExpectSelected(
      r,
      card => card.data.level < 5 && card.data.occupy.length > 0
    )
    if (!card) {
      return
    }
    if (r.player.data.mineral < 4 || !r.player.can_cache()) {
      return
    }
    r.player.obtain_resource({
      mineral: -4,
    })
    await r.player.obtain_card(getCard(card.data.occupy[0]))
    r.player.attrib.config('R机械哨兵', 1)
    r.data.prog_cur -= 1
  }
}

function 异龙(r: IRole) {
  r.player.persisAttrib.config('R异龙', 1)
  r.data.enable = computed<boolean>(() => {
    return !!r.player.persisAttrib.get('R异龙') && r.player.data.mineral >= 2
  }) as unknown as boolean
  r.player.bus.on('tavern-upgraded', async () => {
    r.player.persisAttrib.config('R异龙', 1)
  })
  return async () => {
    if (!r.player.persisAttrib.get('R异龙') || r.player.data.mineral < 2) {
      return
    }
    r.player.obtain_resource({
      mineral: -2,
    })
    await r.player.discover(
      r.player.game.pool.discover(
        c => c.race === 'Z' && c.level <= r.player.data.level,
        4,
        false
      )
    )
    r.player.persisAttrib.config('R异龙', 0)
  }
}

function 医疗兵(r: IRole) {
  return ActPerRound(r, 1, async role => {
    const card = ExpectSelected(role)
    if (!card) {
      return false
    }
    const units = card.filter(u => isNormal(u) && isBiological(u) && !isHero(u))
    await role.player.destroy(card)
    const cards = role.player.present
      .filter(isCardInstance)
      .filter(c => c.data.name !== '虫卵')
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      await c.obtain_unit(units.filter((u, j) => j % cards.length === i))
    }
    role.player.obtain_resource({
      mineral: 1,
    })

    return true
  })
}

function 分裂池(r: IRole) {
  return ActPerRound(r, 1, async role => {
    const card = ExpectSelected(role)
    if (!card) {
      return false
    }
    await card.incubate(-1)
    return true
  })
}

function 响尾蛇(r: IRole) {
  r.data.prog_cur = 0
  r.data.prog_max = 3
  r.player.bus.on('tavern-upgraded', async () => {
    if (r.data.prog_cur === r.data.prog_max) {
      r.data.prog_cur = 0
    }
  })
  r.refreshed = async () => {
    if (r.data.prog_cur < r.data.prog_max) {
      r.data.prog_cur += 1
      if (r.data.prog_cur === r.data.prog_max) {
        await r.player.discover(
          r.player.game
            .shuffle(
              AllCard.map(getCard).filter(
                c => c.pool && c.level === r.player.data.level
              )
            )
            .slice(0, r.player.data.level === 6 ? 3 : 4),
          { nodrop: true }
        )
      }
    }
  }
}

function 混合体(r: IRole) {
  r.player.bus.on('round-finish', async () => {
    const hybrid: Record<number, UnitKey> = {
      1: '混合体掠夺者',
      2: '混合体天罚者',
      3: '混合体毁灭者',
      4: '混合体巨兽',
      5: '混合体支配者',
      6: '混合体实验体',
    }
    for (let i = 1; i <= 6; i++) {
      const ps = r.player.all_of('P').filter(c => c.data.level === i)
      const zs = r.player.all_of('Z').filter(c => c.data.level === i)
      while (ps.length > 0 && zs.length > 0) {
        const cs = r.player.game.shuffle([
          ps.shift() as CardInstance,
          zs.shift() as CardInstance,
        ])
        await cs[0].obtain_unit([hybrid[i]])
      }
    }
  })
}

function 德哈卡(r: IRole) {
  r.data.enable = true
  r.data.prog_cur = 0
  r.player.bus.on('round-enter', async () => {
    r.data.prog_cur += r.player.data.gas
  })
  return async () => {
    const card = ExpectSelected(r)
    if (!card) {
      return
    }
    if (card.data.belong === 'origin') {
      const evolution: Record<
        | '原始蟑螂'
        | '原始刺蛇'
        | '原始异龙'
        | '暴掠龙'
        | '原始雷兽'
        | '德哈卡分身',
        UnitKey
      > = {
        原始蟑螂: '原始点火虫',
        原始刺蛇: '原始穿刺者',
        原始异龙: '原始守卫',
        暴掠龙: '毒裂兽',
        原始雷兽: '原始暴龙兽',
        德哈卡分身: '德哈卡',
      }
      const units = r.player.game.shuffle(
        card.data.units
          .map((u, i) => [u, i] as [UnitKey, number])
          .filter(([u]) => u in evolution) as [keyof typeof evolution, number][]
      )
      if (units.length === 0) {
        return
      }
      r.data.prog_cur -= 1
      card.replace_unit([units[0][1]], evolution[units[0][0]])
    } else {
      if (r.data.prog_cur < 6) {
        return
      }
      r.data.prog_cur -= 6
      const cardt = getCard('原始刺蛇')
      card.clear_desc()
      card.attrib.cleanView()
      const descs = Descriptors[cardt.name]
      if (descs) {
        for (let i = 0; i < descs.length; i++) {
          card.add_desc(descs[i], cardt.desc[i])
        }
      } else {
        console.log('WARN: Card Not Implement Yet')
      }
      card.data.name = '原始刺蛇'
      card.data.level = 2
      card.data.race = 'N'
      card.data.belong = 'origin'
      if (card.data.color === 'darkgold') {
        card.data.color = 'gold'
      }
      card.bindDef()
    }
  }
}

function 星港(r: IRole) {
  r.player.bus.on('round-enter', async () => {
    for (const card of r.player.present.filter(isCardInstance)) {
      card.replace_unit(
        card.find(u => isNormal(u) && !getUnit(u).air, r.player.data.level - 1),
        u => (isHero(u) ? '战列巡航舰' : '怨灵战机')
      )
    }
  })
  r.player.bus.on('round-finish', async () => {
    for (const card of r.player.present.filter(isCardInstance)) {
      const maxi = mostValueUnit(
        card.data.units.filter(u => !isHero(u) && getUnit(u).air)
      )
      if (maxi[0]) {
        card.replace_unit(card.find('怨灵战机', 1), maxi[0])
      }
    }
  })
}

function 锻炉(r: IRole) {
  r.data.prog_max = 50
  r.data.prog_cur = 0
  r.player.bus.on('card-selled', async ({ target }) => {
    if (target.data.name !== '虫卵') {
      if (r.data.prog_cur < r.data.prog_max) {
        r.data.prog_cur += 2
      }
    }
  })
}

function 扎加拉(r: IRole) {
  r.data.prog_cur = computed<number>(() => {
    return r.player.data.present.filter(isCardInstanceAttrib).length
  }) as unknown as number
  r.data.prog_max = 6
  r.player.bus.on('round-enter', async () => {
    if (r.data.prog_cur >= r.data.prog_max) {
      const max_pos = r.player.data.present
        .map((c, i) => [c, i] as [CardInstanceAttrib, number])
        .filter(([c]) => isCardInstanceAttrib(c))
        .map(([c, i]) => [c.value, i] as [number, number])
        .sort(([va, ia], [vb, ib]) => {
          if (va === vb) {
            return ia - ib
          } else {
            return vb - va
          }
        })[0][1]
      await r.player.destroy(r.player.present[max_pos] as CardInstance)

      const min_pos = r.player.data.present
        .map((c, i) => [c, i] as [CardInstanceAttrib, number])
        .filter(([c]) => isCardInstanceAttrib(c))
        .map(([c, i]) => [c.value, i] as [number, number])
        .sort(([va, ia], [vb, ib]) => {
          if (va === vb) {
            return ia - ib
          } else {
            return va - vb
          }
        })[0][1]
      await r.player.destroy(r.player.present[min_pos] as CardInstance)
      r.player.obtain_resource({
        mineral: 11,
      })
    }
  })
}

function 大力神(r: IRole) {
  let cho3: CardKey = '不死队',
    cho5: CardKey = '不死队'
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round === 1) {
      const c5 = r.player.game.pool.discover(c => c.level === 5, 3)
      await r.player.discover(c5, {
        fake: cho => {
          cho5 = c5[cho].name
        },
      })
      const c3 = r.player.game.pool.discover(c => c.level === 3, 3)
      await r.player.discover(c3, {
        fake: cho => {
          cho3 = c3[cho].name
        },
      })
      r.player.game.pool.drop([...c3, ...c5])
    }
  })
  r.player.bus.on('tavern-upgraded', async ({ level }) => {
    switch (level) {
      case 2:
      case 4:
        r.player.data.upgrade_cost += 1
        break
      case 3:
        await r.player.obtain_card(getCard(cho3))
        break
      case 5:
        await r.player.obtain_card(getCard(cho5))
        break
    }
  })
  return ActPerRound(r, 1, async role => {
    const card = ExpectSelected(role)
    if (!card) {
      return false
    }
    const fpos = card.data.pos
    const pos = await role.player.queryInsert()
    if (fpos === pos) {
      return false
    }
    const another = role.player.present[pos]
    if (another) {
      role.player.unput(another)
    }
    role.player.unput(card)
    role.player.put(card, pos)
    if (another) {
      role.player.put(another, fpos)
    }
    return true
  })
}

function 凯瑞甘(r: IRole) {
  r.data.prog_max = 5
  r.player.bus.begin()
  r.player.bus.on('tavern-upgraded', async () => {
    r.player.attrib.config('R凯瑞甘_刷新', 1)
  })
  r.player.bus.on('round-enter', async () => {
    r.data.prog_cur = 0
  })
  const cl = r.player.bus.end()
  r.refresh_cost = () => {
    return r.player.attrib.get('R凯瑞甘_刷新') ? 0 : 1
  }
  r.refreshed = async () => {
    r.player.attrib.config('R凯瑞甘_刷新', 0)
  }
  r.bought = async () => {
    r.data.prog_cur += 1
    if (r.data.prog_cur === r.data.prog_max) {
      r.data.data = getRole('凯瑞甘(异虫形态)')
      r.data.enpower = true
      r.data.prog_cur = -1
      r.data.prog_max = -1
      r.refresh_cost = () => 1
      r.refreshed = async () => {
        //
      }
      r.bought = async () => {
        //
      }
      cl()

      r.player.data.gas = 0
      r.player.data.config.MaxGas = 0
      for (const card of r.player.present.filter(isCardInstance)) {
        if (card.data.occupy.length === 0) {
          continue
        }
        const units: UnitKey[] = []
        const cardt = getCard(card.data.occupy[0])
        for (const u in cardt.unit) {
          units.push(...us(u as UnitKey, cardt.unit[u as UnitKey] as number))
        }
        if (card.data.color === 'gold') {
          units.push(...units)
        }
        await card.obtain_unit(units)
      }
      r.player.bus.on('card-entered', async ({ target }) => {
        await r.player.discover(
          r.player.game
            .shuffle(AllUpgrade.filter(u => getUpgrade(u).category === '3'))
            .slice(0, 3),
          {
            target,
          }
        )
      })
    }
  }
}

function 米拉(r: IRole) {
  r.data.prog_cur = 6
  r.player.bus.on('card-entered', async ({ target }) => {
    if (target.data.level > r.data.prog_cur) {
      r.player.obtain_resource({
        mineral: 1,
      })
    }
    r.data.prog_cur = target.data.level
  })
}

function 先知(r: IRole) {
  r.data.prog_max = 1
  r.data.prog_cur = 1
  r.data.enable = computed<boolean>(() => {
    return r.data.prog_cur > 0
  }) as unknown as boolean
  r.player.bus.on('upgrade-cancelled', async () => {
    if (!r.player.attrib.get('R先知')) {
      r.player.obtain_resource({
        gas: 1,
      })
      r.player.attrib.config('R先知', 1)
    }
  })
  r.player.data.config.MaxUpgradePerCard += 1
  return async () => {
    const card = ExpectSelected(
      r,
      c => c.data.upgrades.length < r.player.data.config.MaxUpgradePerCard
    )
    if (!card) {
      return
    }
    r.data.prog_cur -= 1
    await r.player.discover(
      r.player.game
        .shuffle(AllUpgrade.filter(u => getUpgrade(u).category === '3'))
        .slice(0, 3),
      {
        target: card,
      }
    )
  }
}

function 阿尔达瑞斯(r: IRole) {
  let lockedPlace: number[] = []
  let prevLockedPlace: number[] = []
  r.player.data.storeStatus = computed<StoreStatus[]>(() => {
    return r.player.data.store.map((k, i) => ({
      locked: !!k && r.player.data.locked,
      special: prevLockedPlace.includes(i),
    }))
  }) as unknown as StoreStatus[]
  r.player.bus.on('$lock', async () => {
    lockedPlace = r.player.data.store
      .map((c, i) => [c, i] as [CardKey | null, number])
      .filter(([c]) => c)
      .map(([c, i]) => i)
  })
  r.player.bus.on('$unlock', async () => {
    lockedPlace = []
  })
  r.player.bus.on('round-end', async () => {
    prevLockedPlace = lockedPlace
    lockedPlace = []
  })
  r.buy_cost = (c, a, p) => {
    return prevLockedPlace.includes(p) ? 2 : 3
  }
  r.bought = async p => {
    prevLockedPlace = prevLockedPlace.filter(i => i !== p)
  }
  r.refreshed = async () => {
    prevLockedPlace = []
  }
}

function 斯托科夫(r: IRole) {
  r.data.prog_cur = computed<number>(() => {
    return r.player.data.level * 3 - 3
  }) as unknown as number
  r.data.enable = computed<boolean>(() => {
    return (
      r.player.data.life > r.data.prog_cur && !r.player.attrib.get('R斯托科夫')
    )
  }) as unknown as boolean
  return async () => {
    if (r.player.data.life <= r.data.prog_cur) {
      return
    }
    r.player.data.life -= r.data.prog_cur
    r.player.attrib.config('R斯托科夫', 1)

    r.player.game.pool.drop(
      (r.player.data.store.filter(x => x !== null) as CardKey[]).map(getCard)
    )
    r.player.data.store = r.player.game.pool
      .discover(
        c => c.level === r.player.data.level,
        r.player.data.store.length,
        false
      )
      .map(c => c.name)
    await r.player.post('refreshed', refP(r.player))
  }
}

function 解放者(r: IRole) {
  r.player.persisAttrib.config('R解放者_模式', 0)

  r.data.data = computed<Role>(() => {
    return r.player.persisAttrib.get('R解放者_模式')
      ? getRole('解放者(防卫模式)')
      : getRole('解放者')
  }) as unknown as Role

  r.data.enpower = computed<boolean>(() => {
    return r.player.persisAttrib.get('R解放者_模式')
      ? false
      : r.player.attrib.get('R解放者_刷新')
      ? false
      : true
  }) as unknown as boolean

  r.refresh_cost = () => {
    return r.player.persisAttrib.get('R解放者_模式')
      ? 9999
      : r.player.attrib.get('R解放者_刷新')
      ? 1
      : 0
  }
  r.buy_cost = () => {
    return r.player.persisAttrib.get('R解放者_模式') ? 2 : 4
  }
  r.refreshed = async () => {
    r.player.attrib.config(
      'R解放者_刷新',
      1 - r.player.attrib.get('R解放者_刷新')
    )
  }

  r.player.bus.on('round-enter', async () => {
    r.data.enable = true
  })

  return async () => {
    r.player.persisAttrib.set(
      'R解放者_模式',
      1 - r.player.persisAttrib.get('R解放者_模式')
    )
    r.data.enable = false
  }
}

function 干扰者(r: IRole) {
  r.player.bus.on('round-enter', async () => {
    r.player.data.upgrade_cost = Math.max(
      0,
      r.player.data.upgrade_cost -
        Math.floor(
          r.player.data.hand.filter(
            c => c && getCard(c).attr.type !== 'support'
          ).length / 2
        )
    )
  })
}

const RoleSet: Record<RoleKey, RoleBind> = {
  白板,
  执政官,
  陆战队员,
  收割者,
  感染虫,
  SCV,
  阿巴瑟,
  工蜂,
  副官,
  追猎者,
  使徒,
  矿骡,
  斯台特曼,
  雷诺,
  阿塔尼斯,
  科学球,
  母舰核心,
  行星要塞,
  拟态虫,
  探机,
  泰凯斯,
  诺娃,
  思旺,
  跳虫,
  蒙斯克,
  雷神,
  机械哨兵,
  异龙,
  医疗兵,
  分裂池,
  响尾蛇,
  混合体,
  德哈卡,
  星港,
  锻炉,
  扎加拉,
  大力神,
  凯瑞甘,
  '凯瑞甘(异虫形态)': 白板,
  米拉,
  先知,
  阿尔达瑞斯,
  斯托科夫,
  解放者,
  '解放者(防卫模式)': 白板,
  干扰者,
}

function 地嗪外溢(r: IRole) {
  r.player.data.config.MaxUpgradePerCard = 8

  r.player.bus.on('card-entered', async ({ target }) => {
    await r.player.discover(
      r.player.game.shuffle(AllUpgrade.filter(x => x !== '献祭')).slice(0, 3),
      {
        target,
      }
    )
  })
}

function 作战规划(r: IRole) {
  let cho2: CardKey = '不死队',
    cho4: CardKey = '不死队',
    cho6: CardKey = '不死队'
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round === 1) {
      const c6 = r.player.game.pool.discover(c => c.level === 6, 3)
      await r.player.discover(c6, {
        fake: cho => {
          cho6 = c6[cho].name
        },
      })
      const c4 = r.player.game.pool.discover(c => c.level === 4, 3)
      await r.player.discover(c4, {
        fake: cho => {
          cho4 = c4[cho].name
        },
      })
      const c2 = r.player.game.pool.discover(c => c.level === 2, 3)
      await r.player.discover(c2, {
        fake: cho => {
          cho2 = c2[cho].name
        },
      })
      r.player.game.pool.drop([...c2, ...c4, ...c6])
    }
  })
  r.player.bus.on('tavern-upgraded', async ({ level }) => {
    switch (level) {
      case 2:
        await r.player.obtain_card(getCard(cho2))
        break
      case 4:
        await r.player.obtain_card(getCard(cho4))
        break
      case 6:
        await r.player.obtain_card(getCard(cho6))
        break
    }
  })
}

const MutationSet: Record<MutationKey, RoleBind> = {
  '辅助角色-诺娃': 诺娃,
  '辅助角色-星港': 星港,
  '辅助角色-泰凯斯': 泰凯斯,
  地嗪外溢,
  作战规划,
}
export function create_role(p: Player, r: RoleKey) {
  return new RoleImpl(p, RoleSet[r], getRole(r))
}

export function create_mutation(p: Player, m: MutationKey) {
  return new RoleImpl(p, MutationSet[m], getRole('白板'))
}
