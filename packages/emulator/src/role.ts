import { computed, reactive } from '@vue/reactivity'
import {
  AllCard,
  AllUpgrade,
  CardKey,
  getCard,
  getRole,
  isNormal,
  Role,
  RoleKey,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance } from './card'
import { Player } from './player'
import { autoBind, us } from './utils'
import { Descriptors } from './descriptor'

export interface RoleData {
  data: Role
  prog_cur: number
  prog_max: number
  enable: boolean
  enpower: boolean
}

interface IRole {
  player: Player
  data: RoleData

  ability(): Promise<void>

  buy_cost(card: CardKey): number
  refresh_cost(): number

  bought(): Promise<void>
  refreshed(): Promise<void>
}

interface RoleBind {
  (role: IRole): () => Promise<void>
}

export class RoleImpl implements IRole {
  player: Player
  data: RoleData

  ability: () => Promise<void>

  buy_cost: (card: CardKey) => number
  refresh_cost: () => number

  bought: () => Promise<void>
  refreshed: () => Promise<void>

  constructor(p: Player, b: RoleBind, r: Role) {
    this.player = p
    this.data = reactive({
      data: r,
      prog_cur: -1,
      prog_max: 0,
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

    this.ability = b(this)
  }
}

function ActPerRole(
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

function 白板() {
  return async () => {
    //
  }
}

function 执政官(r: IRole) {
  return ActPerRole(r, 1, async role => {
    const left = role.player.current_selected()
    if (!(left instanceof CardInstance)) {
      return false
    }
    const right = left.right()
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
      await right.bind_desc(b.bind, b.text, b.data)
    }
    right.attrib.cleanView()
    right.bindDef()
    return true
  })
}

function 陆战队员(r: IRole) {
  return ActPerRole(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 2) {
        return false
      }
      const tl = Math.max(1, role.player.data.level - 1)
      await role.player.obtain_resource({
        mineral: -2,
      })
      await role.player.discover(
        role.player.game.pool.discover(c => c.level === tl, 2)
      )
      return true
    },
    role => {
      return role.player.data.mineral >= 2
    }
  )
}

function 收割者(r: IRole) {
  r.player.data.config.AlwaysInsert = true
  r.buy_cost = c => (getCard(c).attr.insert ? 2 : 3)
  return async () => {
    //
  }
}

function 感染虫(r: IRole) {
  return ActPerRole(r, 1, async role => {
    const card = role.player.current_selected()
    if (!(card instanceof CardInstance)) {
      return false
    }
    if (card.data.race !== 'T') {
      return false
    }
    const infr = card.data.infr
    if (infr[0] === 'reactor') {
      await card.remove_unit([infr[1]])
    }
    card.data.color = 'darkgold'
    card.data.race = 'Z'
    card.data.name = `被感染的${card.data.name}`
    await card.clear_desc()
    await card.add_desc(
      autoBind('round-end', async card => {
        await role.player.inject(card.data.units.filter(isNormal).slice(0, 1))
      }),
      ['每回合结束时注卵随机一个单位', '每回合结束时注卵随机一个单位']
    )
    return true
  })
}

function SCV(r: IRole) {
  return ActPerRole(r, 1, async role => {
    const card = role.player.current_selected()
    if (!(card instanceof CardInstance)) {
      return false
    }
    if (card.data.race !== 'T' || card.data.infr[0] === 'hightech') {
      return false
    }
    await card.switch_infr()
    return true
  })
}

function 阿巴瑟(r: IRole) {
  return ActPerRole(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 2) {
        return false
      }
      const card = role.player.current_selected()
      if (!(card instanceof CardInstance)) {
        return false
      }
      const tl = Math.min(6, card.data.level + 1)
      await role.player.obtain_resource({
        mineral: -2,
      })
      await role.player.destroy(card)
      await role.player.discover(
        role.player.game.pool.discover(c => c.level === tl, 3)
      )
      return true
    },
    role => {
      return role.player.data.mineral >= 2
    }
  )
}

function 工蜂(r: IRole) {
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round % 2 === 1) {
      if (r.player.data.gas < 6) {
        await r.player.obtain_resource({
          gas: 1,
        })
      }
    } else {
      await r.player.obtain_resource({
        mineral: 1,
      })
    }
  })
  return async () => {
    //
  }
}

function 副官(r: IRole) {
  r.data.prog_max = 1
  r.refresh_cost = () => {
    return r.data.prog_cur > 0 ? 0 : 1
  }
  r.player.bus.on('round-enter', async () => {
    r.data.prog_cur = 1
    if (r.player.persisAttrib.get('副官')) {
      await r.player.obtain_resource({
        mineral: 1,
      })
    }
  })
  r.player.bus.on('round-end', async () => {
    r.player.persisAttrib.config('副官', r.player.data.mineral)
  })
  r.refreshed = async () => {
    r.data.prog_cur -= 1
  }
  return async () => {
    //
  }
}

function 追猎者(r: IRole) {
  r.data.prog_max = 5
  r.player.persisAttrib.config('追猎者', 0)
  r.bought = async () => {
    if (r.data.enpower || !r.player.attrib.get('追猎者')) {
      r.player.attrib.config('追猎者', 1)
      await r.player.do_refresh()
    }
  }
  r.player.bus.on('round-enter', async () => {
    if (!r.data.enpower) {
      r.data.prog_cur = 0
    }
  })
  r.player.bus.on('refreshed', async () => {
    if (!r.data.enpower && r.data.prog_cur < r.data.prog_max) {
      r.data.prog_cur += 1
      if (r.data.prog_cur === r.data.prog_max) {
        r.data.enpower = true
      }
    }
  })
  return async () => {
    //
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
  r.buy_cost = () => {
    return r.data.enpower ? 1 : 3
  }
  r.player.bus.on('round-start', async () => {
    r.data.prog_cur = 0
  })
  return async () => {
    //
  }
}

function 矿骡(r: IRole) {
  r.player.bus.on('round-enter', async () => {
    if (r.player.persisAttrib.get('矿骡')) {
      r.data.enable = false
      await r.player.obtain_resource({
        mineral: 2 - r.player.data.mineral_max,
      })
      r.player.persisAttrib.config('矿骡', 0)
    } else {
      r.data.enable = true
    }
  })
  return async () => {
    r.player.persisAttrib.config('矿骡', 1)
    r.data.enable = false
    await r.player.obtain_resource({
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
    await r.player.obtain_resource({
      gas: 1,
    })
  })
  r.player.bus.on('round-start', async ({ round }) => {
    if (round > 1) {
      await r.player.obtain_resource({
        gas: -1,
      })
    }
  })
  return async () => {
    //
  }
}

function 雷诺(r: IRole) {
  r.data.enable = true

  return async () => {
    const card = r.player.current_selected()
    if (!(card instanceof CardInstance)) {
      return
    }
    if (card.data.color !== 'normal' || card.data.level >= 6) {
      return
    }
    card.data.color = 'gold'
    const descs = card.data.descriptors
    await card.clear_desc()
    for (const d of descs) {
      await card.add_desc(d.data.desc, d.data.text)
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
          await target.add_desc(descs[i], cardt.desc[i])
        }
      } else {
        console.log('WARN: Card Not Implement Yet')
      }

      target.data.name = '大主教的卫队'
      target.data.color = 'darkgold'
    }
  })
  return async () => {
    //
  }
}

function 母舰核心(r: IRole) {
  r.data.prog_max = 2
  r.data.prog_cur = 0
  r.player.bus.on('round-enter', async ({ round }) => {
    if (round === 1) {
      await r.player.obtain_resource({
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
          await c.replace_unit(c.find('母舰核心', 1), '母舰')
        }
      }
    }
    if (c) {
      await c.obtain_unit(us('虚空辉光舰', r.player.data.level))
    }
  })
  return async () => {
    //
  }
}

function 行星要塞(r: IRole) {
  r.player.bus.on('card-entered', async ({ target }) => {
    if (target.data.belong === 'building') {
      await target.obtain_unit(us('自动机炮', target.player.data.level + 1))
    }
  })
  return ActPerRole(
    r,
    1,
    async role => {
      if (role.player.data.mineral < 3) {
        return false
      }
      await role.player.obtain_resource({
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
    role => {
      return role.player.data.mineral >= 3
    }
  )
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
  母舰核心,
  行星要塞,
}

export function create_role(p: Player, r: RoleKey) {
  return new RoleImpl(p, RoleSet[r], getRole(r))
}
