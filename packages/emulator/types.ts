import { CardKey, UnitKey, UpgradeKey } from 'data'
import { CardInstance } from './card'
import { Emitter } from './emitter'

type ApplyKey<T, I extends {}> = {
  [key in keyof T]: T[key] & I
}

interface InputBusTemplate {
  $upgrade: {}
  $refresh: {}
  $done: {}
  $lock: {}
  $unlock: {}

  '$insert-choice': {
    choice: number
  }
  '$discover-choice': {
    choice: number
  }

  '$buy-enter': {
    place: number
  }
  '$buy-combine': {
    place: number
  }
  '$buy-cache': {
    place: number
  }
  '$hand-enter': {
    place: number
  }
  '$hand-combine': {
    place: number
  }
  '$hand-sell': {
    place: number
  }
  '$present-upgrade': {
    place: number
  }
  '$present-sell': {
    place: number
  }

  '$obtain-card': {
    card: CardKey
  }
  $imr: {}
}

type InputBus = ApplyKey<InputBusTemplate, { player: number }>

type GameBus = {
  'round-start': {
    round: number
  }
  'round-end': {
    round: number
  }
}

type PlayerBusTemplate = {
  'tavern-upgraded': {
    // 升级酒馆
    level: number
  }
  refreshed: {} // 刷新商店

  'card-destroyed': {
    // 摧毁卡牌
    target: CardInstance
  }
  'card-entered': {
    // 进场卡牌
    target: CardInstance
  }
  'card-combined': {
    // 三连卡牌
    target: CardInstance
  }
  'card-selled': {
    // 出售卡牌
    target: CardInstance
  }

  incubate: {
    // 孵化
    from: CardInstance
    units: UnitKey[]
  }
  inject: {
    // 注卵
    units: UnitKey[]
  }
  wrap: {
    // 折跃
    units: UnitKey[]
    into: CardInstance | null
  }
}

type PlayerBus = ApplyKey<PlayerBusTemplate, { player: number }>

export type ObtainUnitWay = 'normal' | 'incubate' | 'wrap'

type CardBusTemplate = {
  'obtain-unit-prev': {
    // 获得单位前
    units: UnitKey[]
    way: ObtainUnitWay
  }
  'obtain-unit-post': {
    // 获得单位后
    units: UnitKey[]
    way: ObtainUnitWay
  }

  'task-done': {}
  'infr-changed': {} // 挂件切换
  'fast-prod': {} // 快速生产

  regroup: {
    // 集结
    id: number
  }

  'gain-darkness': {
    // 获得黑暗值
    dark: number
  }

  'post-enter': {}
  'post-sell': {}
  seize: {
    // 夺取
    target: CardInstance
  }
}

type CardBus = ApplyKey<
  CardBusTemplate,
  { player: number; card: number | Emitter<LogicBus> }
>

export type LogicBus = GameBus & PlayerBus & CardBus & InputBus

interface OutputBusTemplate {
  refresh: {}
  'begin-insert': {}
  'end-insert': {}
  'begin-discover': {
    item: (CardKey | UpgradeKey)[]
    cancel: boolean
  }
  'end-discover': {}
}

export type OutputBus = ApplyKey<OutputBusTemplate, { client: number }>

export interface DescriptorGenerator {
  (card: CardInstance, gold: boolean, text: [string, string]): Descriptor // 白球之类的导致不能单纯靠卡牌属性来判断是否为金色
}

export interface Descriptor {
  text: [string, string]
  gold: boolean
  unique?: string
  disabled?: boolean

  unbind(): void
}

export type CardDescriptorTable = {
  [key in CardKey]?: DescriptorGenerator[]
}

export interface PlayerConfig {
  MaxUnitPerCard: number
  MaxUpgradePerCard: number
  AlwaysInsert: boolean

  StoreCount: number[]
  UpgradeCost: number[]

  MaxMineral: number
  MaxGas: number
}
