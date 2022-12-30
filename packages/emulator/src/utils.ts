import { reactive } from '@vue/reactivity'
import { getUnit, UnitKey } from '@sctavern-emulator/data'
import { Random, RNG } from 'random'
import { CardInstance, CardInstanceAttrib } from './card'
import { Descriptor, DescriptorGenerator } from './types'
import { DispatchEndpoint, GetMsg, MsgKeyOf } from './dispatcher'
import { InnerMsg } from './events'

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

  int(max: number, min = 0) {
    return this.gen.int(min, max)
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

export function autoBindX(
  factory: (
    card: CardInstance,
    gold: boolean,
    desc: Descriptor
  ) => DispatchEndpoint<MsgKeyOf<InnerMsg>, InnerMsg>,
  option?: {
    unique?: string
    uniqueNoGold?: true
    init?: (card: CardInstance, gold: boolean, desc: Descriptor) => void
    attr?: Record<string, number>
  }
): DescriptorGenerator {
  return (card, gold) => {
    const desc: Descriptor = reactive({
      gold,
      disabled: false,
      unique: option?.unique,
      uniqueNoGold: !!option?.uniqueNoGold,
    })
    option?.init?.(card, gold, desc)
    if (option?.attr) {
      for (const k in option.attr) {
        card.attrib.alter(k, option.attr[k])
      }
    }
    const obj = factory(card, gold, desc)
    card.$on(obj)
    desc.unbind = () => {
      if (option?.attr) {
        for (const k in option.attr) {
          card.attrib.alter(k, -option.attr[k])
        }
      }
      card.$off(obj)
    }
    return desc
  }
}

export function autoBind<T extends MsgKeyOf<InnerMsg>>(
  msg: T,
  func: (
    card: CardInstance,
    gold: boolean,
    param: GetMsg<InnerMsg, T>
  ) => Promise<void>
) {
  return autoBindX((card, gold) => ({
    [msg]: async (param: GetMsg<InnerMsg, T>) => {
      await func(card, gold, param)
    },
  }))
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
