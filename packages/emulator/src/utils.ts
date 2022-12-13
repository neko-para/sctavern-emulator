import { reactive } from '@vue/reactivity'
import { getUnit, UnitKey } from '@sctavern-emulator/data'
import { Random, RNG } from 'random'
import { CardInstance, CardInstanceAttrib } from './card'
import { Player } from './player'
import {
  Descriptor,
  DescriptorGenerator,
  LogicBus,
  LogItem,
  Postable,
} from './types'

export class Shuffler {
  gen: Random

  constructor(seed: string) {
    this.gen = new Random()
    this.gen.use(seed as unknown as RNG)
  }

  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.gen.int(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}

export function refC(card: CardInstance) {
  return {
    player: card.player.pos,
    card: card.data.pos === -1 ? card.bus : card.data.pos,
  }
}

export function refP(player: Player) {
  return {
    player: player.pos,
  }
}

export function isCardInstance(
  card: CardInstance | null
): card is CardInstance {
  return !!card
}

export function isCardInstanceAttrib(
  card: CardInstanceAttrib | null
): card is CardInstanceAttrib {
  return !!card
}

export function autoBindSome(
  func: (card: CardInstance, gold: boolean) => void
): DescriptorGenerator {
  return (card, gold) => {
    card.bus.begin()
    func(card, gold)
    return reactive({
      gold,

      unbind: card.bus.end(),
    })
  }
}

export function autoBind<T extends keyof LogicBus>(
  msg: T,
  func: (card: CardInstance, gold: boolean, param: LogicBus[T]) => Promise<void>
): DescriptorGenerator {
  return autoBindSome((c, g) => {
    c.bus.on(msg, async param => {
      await func(c, g, param)
    })
  })
}

export function autoBindUnique(
  func: (card: CardInstance, desc: Descriptor) => void,
  unique: string,
  uniqueNoGold = false
): DescriptorGenerator {
  return (card, gold) => {
    const ret: Descriptor = reactive({
      gold,
      disabled: false,
      unique,
      uniqueNoGold,
    })
    card.bus.begin()
    func(card, ret)
    ret.unbind = card.bus.end()
    return ret
  }
}

export function fake(): DescriptorGenerator {
  return (card, gold) => {
    return reactive({
      gold,
    })
  }
}

export function us(u: UnitKey, n: number): UnitKey[] {
  return Array(n).fill(u)
}

export function mostValueUnit(
  u: UnitKey[],
  cmp: (v1: number, v2: number) => boolean = (v1, v2) => v1 > v2,
  cv: (u: UnitKey) => number = u => getUnit(u).value
): [UnitKey | null, number] {
  if (u.length === 0) {
    return [null, -1]
  }
  let cur = u[0],
    curi = 0,
    curv = cv(u[0])
  for (let i = 1; i < u.length; i++) {
    const nv = cv(u[i])
    if (cmp(nv, curv)) {
      cur = u[i]
      curi = i
      curv = nv
    }
  }
  return [cur, curi]
}

export async function postItem<T>(into: Postable<T>, item: LogItem) {
  await into.post(item.msg as keyof T, item.param as T[keyof T])
}
