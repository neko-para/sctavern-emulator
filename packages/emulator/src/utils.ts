import { reactive } from '@vue/reactivity'
import { UnitKey } from '@sctavern-emulator/data'
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

export function autoBind<T extends keyof LogicBus>(
  msg: T,
  func: (card: CardInstance, gold: boolean, param: LogicBus[T]) => Promise<void>
): DescriptorGenerator {
  return (card, gold) => {
    card.bus.begin()
    card.bus.on(msg, async param => {
      await func(card, gold, param)
    })
    return reactive({
      gold,

      unbind: card.bus.end(),
    })
  }
}

export function autoBindPlayer<T extends keyof LogicBus>(
  msg: T,
  func: (card: CardInstance, gold: boolean, param: LogicBus[T]) => Promise<void>
): DescriptorGenerator {
  return (card, gold) => {
    card.player.bus.begin()
    card.player.bus.on(msg, async param => {
      await func(card, gold, param)
    })
    return reactive({
      gold,

      unbind: card.player.bus.end(),
    })
  }
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
    card.player.bus.begin()
    func(card, ret)
    const cc = card.bus.end()
    const pc = card.player.bus.end()
    ret.unbind = () => {
      cc()
      pc()
    }
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

export async function postItem<T>(into: Postable<T>, item: LogItem) {
  await into.post(item.msg as keyof T, item.param as T[keyof T])
}
