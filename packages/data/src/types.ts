import {
  CardKey,
  TermKey,
  UnitKey,
  UpgradeKey,
  RoleKey,
  PossibleKey,
  MutationKey,
} from './pubdata'

export type Race = 'T' | 'P' | 'Z' | 'N' | 'G'
export type Pack =
  | '核心'
  | '天空之怒'
  | '并肩作战'
  | '拉克希尔'
  | '短兵相接'
  | '快速启动'
  | '独辟蹊径'
  | '军备竞赛'
type UnitType = 'normal' | 'spbd' | 'spun'
type UpgradeCategory = 'S' | '3' | 'T' | 'P' | 'Z' | 'C' | 'V' | 'O'

type SplitResultString = {
  t: 'str'
  s: string
  m?: true
}

export type SplitResultRefer = {
  t: 'ref'
  s: PossibleKey
  m?: true
}

type SplitResultUser = {
  t: 'usr'
  s: string
  m?: true
}

export type SplitResultNode =
  | SplitResultString
  | SplitResultRefer
  | SplitResultUser

export type SplitResult = SplitResultNode[]

export interface Card {
  name: CardKey
  pinyin: string
  type: 'card'
  race: Race
  level: number
  pack: Pack
  pool: boolean
  unit: {
    [key in UnitKey]?: number
  }
  desc: [string, string][]
  banner?: string
  attr: {
    rare?: boolean
    gold?: boolean
    insert?: boolean
    origin?: boolean
    dark?: boolean
    void?: boolean
    type?: 'building' | 'support'
  }
  rmrk?: string
}

export interface Term {
  name: TermKey
  pinyin: string
  type: 'term'
  race: Race
  bref: string
  extr?: string
}

export interface Weapon {
  name: string
  damage: number | string
  multiple?: number
  range: number | 'melee' | '未知'
  speed: number | '未知'
  target: 'G' | 'A' | 'GA'
}

export interface Armor {
  name: string
  defense: number
  speed: number | string
}

export interface SArmor {
  name: string
  defense: number
}

export interface Unit {
  name: UnitKey
  pinyin: string
  type: 'unit'
  race: Race
  utype: UnitType
  value: number

  tag: string[]
  health: number
  shield?: number
  power?: number
  air?: true

  weapon?: Weapon[]
  armor?: Armor
  sarmor?: SArmor

  bref?: string
  rmrk?: string
}

export interface Upgrade {
  name: UpgradeKey
  pinyin: string
  type: 'upgrade'
  override: boolean
  category: UpgradeCategory
  bref: string
  rmrk: string
}

export interface Role {
  name: RoleKey
  pinyin: string
  type: 'role'
  ability: string
  desc: string
  ext?: true
}

export interface Mutation {
  name: MutationKey
  pinyin: string
  type: 'mutation'
  prole?: RoleKey
}

export interface Data {
  card: Card[]
  term: Term[]
  unit: Unit[]
  upgrade: Upgrade[]
  role: Role[]
  mutation: Mutation[]
  tr: Record<string, string>
  attr: Record<string, string>
  order: Record<string, string[]>
}
