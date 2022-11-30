import { computed, reactive } from '@vue/reactivity'
import {
  CardKey,
  getCard,
  getRole,
  isNormal,
  RoleKey,
} from '@sctavern-emulator/data'
import { CardInstance } from './card'
import { Player } from './player'
import { autoBind } from './utils'

export interface RoleData {
  name: string
  prog_cur: number
  prog_max: number
  enable: boolean
  enpower: boolean
}

interface Role {
  player: Player
  data: RoleData

  ability(): Promise<void>

  buy_cost(card: CardKey): number
  refresh_cost(): number

  bought(): Promise<void>
  refreshed(): Promise<void>
}

interface RoleBind {
  (role: Role): () => Promise<void>
}

export class RoleImpl implements Role {
  player: Player
  data: RoleData

  ability: () => Promise<void>

  buy_cost: (card: CardKey) => number
  refresh_cost: () => number

  bought: () => Promise<void>
  refreshed: () => Promise<void>

  constructor(p: Player, b: RoleBind, n: string) {
    this.player = p
    this.data = reactive({
      name: n,
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
  r: Role,
  c: number,
  a: (r: Role) => Promise<boolean>,
  e: (r: Role) => boolean = () => true
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

function 执政官(r: Role) {
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
      await right.bind_desc(b.bind, b.text)
    }
    return true
  })
}

function 陆战队员(r: Role) {
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

function 收割者(r: Role) {
  r.player.data.config.AlwaysInsert = true
  r.buy_cost = c => (getCard(c).attr.insert ? 2 : 3)
  return async () => {
    //
  }
}

function 感染虫(r: Role) {
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

function SCV(r: Role) {
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

function 阿巴瑟(r: Role) {
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

function 工蜂(r: Role) {
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

function 副官(r: Role) {
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

function 追猎者(r: Role) {
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
}

export function create_role(p: Player, r: RoleKey) {
  return new RoleImpl(p, RoleSet[r], getRole(r).ability)
}
