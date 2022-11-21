import { Random, RNG } from 'random'
import { CardInstance } from './card'
import { Player } from './player'

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
