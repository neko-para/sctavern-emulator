import {
  Card,
  CardKey,
  UnitKey,
  Upgrade,
  UpgradeKey,
} from '@sctavern-emulator/data'
import { CardInstance } from './card'
import { GameArea, ObtainUnitWay } from './types'

type ApplyKey<T, I> = T extends unknown ? T & I : never

export type InputMsg = ApplyKey<
  | {
      msg: '$upgrade'
    }
  | {
      msg: '$refresh'
    }
  | {
      msg: '$finish'
    }
  | {
      msg: '$ability'
    }
  | {
      msg: '$lock'
    }
  | {
      msg: '$unlock'
    }
  | {
      msg: '$select'
      choice: number
      area: GameArea
    }
  | {
      msg: '$choice'
      choice: number
      category: 'insert' | 'discover' | 'deploy'
    }
  | ApplyKey<
      | {
          area: 'store'
          action: 'enter' | 'combine' | 'stage'
        }
      | {
          area: 'hand'
          action: 'enter' | 'combine' | 'sell'
        }
      | {
          area: 'present'
          action: 'upgrade' | 'sell'
        },
      {
        msg: '$action'
        choice: number
      }
    >
  | ApplyKey<
      | {
          type: 'card'
          cardt: CardKey
        }
      | {
          type: 'unit'
          units: UnitKey[]
          place: number
        }
      | {
          type: 'resource'
        },
      {
        msg: '$cheat'
      }
    >,
  { player: number }
>

export type GameMsg = ApplyKey<
  | {
      msg: 'round-start'
    }
  | {
      msg: 'round-enter'
    }
  | {
      msg: 'round-end'
    }
  | {
      msg: 'round-leave'
    },
  {
    round: number
  }
>

export type PlayerMsg = ApplyKey<
  | {
      msg: 'tavern-upgraded'
      level: number
    }
  | {
      msg: 'store-refreshed'
    }
  | {
      msg: 'card-entered'
      target: CardInstance
    }
  | {
      msg: 'card-combined'
      target: CardInstance
    }
  | {
      msg: 'card-selled'
      target: CardInstance
      pos: number
      flag: boolean
    }
  | {
      msg: 'upgrade-cancelled'
      target: CardInstance
    }
  | {
      msg: 'task-done'
      target: CardInstance
    }
  | {
      msg: 'infr-changed'
      target: CardInstance
    }
  | {
      msg: 'seize'
      target: CardInstance
      from: CardInstance
    }
  | {
      msg: 'incubate'
      units: UnitKey[]
      from: CardInstance
    }
  | {
      msg: 'inject'
      units: UnitKey[]
    }
  | {
      msg: 'wrap'
      units: UnitKey[]
      into: CardInstance | null
    },
  {
    player: number
  }
>

export type CardMsg = ApplyKey<
  | {
      msg: 'obtain-unit'
      units: UnitKey[]
      way: ObtainUnitWay
      time: 'prev' | 'post'
    }
  | {
      msg: 'obtain-upgrade'
      upgrade: UpgradeKey
    }
  | {
      msg: 'fast-produce'
    }
  | {
      msg: 'req-incubate'
      id: number
    }
  | {
      msg: 'req-regroup'
      id: number
    }
  | {
      msg: 'obtain-darkness'
      darkness: number
    }
  | {
      msg: 'post-enter'
    }
  | {
      msg: 'post-sell'
      pos: number
    }
  | {
      msg: 'post-deploy'
      target: CardInstance
    },
  {
    player: number
    card: number | CardInstance
  }
>

export type OutputMsg = ApplyKey<
  | {
      msg: 'selected'
      area: GameArea
      choice: number
    }
  | ApplyKey<
      | {
          msg: 'insert'
        }
      | {
          msg: 'deploy'
        }
      | {
          msg: 'discover'
          item: (Card | Upgrade | string)[]
          extra?: string
        },
      {
        time: 'begin' | 'end'
      }
    >,
  {
    client: number
  }
>

export type InnerMsg = GameMsg | PlayerMsg | CardMsg | InputMsg
export type OutterMsg = OutputMsg
