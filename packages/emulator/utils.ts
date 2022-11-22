import { Random, RNG } from 'random'
import { CardInstance } from './card'
import { Player } from './player'
import { DescriptorGenerator, LogicBus } from './types'

export class Shuffler {
  gen: Random

  constructor(seed: string) {
    this.gen = new Random()
    this.gen.use(seed as unknown as RNG)
  }

  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      let j = this.gen.int(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}

export function refC(card: CardInstance) {
  return {
    player: card.player.pos,
    card: card.pos,
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

export function isNotCardInstance(card: CardInstance | null): card is null {
  return !card
}

export function autoBind<T extends keyof LogicBus>(
  msg: T,
  func: (card: CardInstance, gold: boolean, param: LogicBus[T]) => Promise<void>
): DescriptorGenerator {
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on(msg, async param => {
      await func(card, gold, param)
    })
    const cleaner = card.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
}

export function autoBindPlayer<T extends keyof LogicBus>(
  msg: T,
  func: (card: CardInstance, gold: boolean, param: LogicBus[T]) => Promise<void>
): DescriptorGenerator {
  return (card, gold, text) => {
    card.player.bus.begin()
    card.player.bus.on(msg, async param => {
      await func(card, gold, param)
    })
    const cleaner = card.player.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
}
