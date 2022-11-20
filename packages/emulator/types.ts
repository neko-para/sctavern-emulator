import { CardKey, UnitKey, UpgradeKey } from 'data'
import { CardInstance } from './card'

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
  discover: {
    // 发现
    item: (CardKey | UpgradeKey)[]
    target?: CardInstance
    cancel?: true
  }

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
    from: CardInstance
    units: UnitKey[]
  }

  wrap: {
    // 折跃
    units: UnitKey[]
    into: CardInstance | null
  }
}

type PlayerBus = ApplyKey<PlayerBusTemplate, { player: number }>

type CardBusTemplate = {
  'obtain-unit': {
    // 获得单位
    units: UnitKey[]
  }
  'obtain-upgrade': {
    // 获得升级
    upgrade: UpgradeKey
  }
  'replace-unit': {
    places: number[]
    unit: UnitKey | ((u: UnitKey) => UnitKey)
  }
  'clear-desc': {
    // 清除卡面描述
  }
  'add-desc': {
    // 添加卡面描述
    desc: DescriptorGenerator
  }

  seize: {
    // 夺取
    target: CardInstance
    real: boolean
    upgrade: 'discard' | 'keep'
  }

  'task-done': {}
  'infr-changed': {} // 挂件切换
  'fast-prod': {} // 快速生产

  'incubate-into': {
    // 孵化入 用于孵化所
    units: UnitKey[]
  }

  regroup: {
    // 集结
    id: number
  }
  'regroup-count': {
    // 查询集结词条个数 用于后勤处
    count: number
  }
  'wrap-into': {
    // 折跃入 用于英雄叉
    units: UnitKey[]
  }

  'gain-darkness': {
    // 获得黑暗值
    dark: number
  }

  'post-enter': {}
  'post-sell': {}
}

type CardBus = ApplyKey<CardBusTemplate, { player: number; card: number }>

export type LogicBus = GameBus & PlayerBus & CardBus & InputBus

interface OutputBusTemplate {
  'info-update': {}
  'store-update': {
    place: number
  }
  'hand-update': {
    place: number
  }
  'present-update': {
    place: number
  }
}

export type OutputBus = ApplyKey<OutputBusTemplate, { client: number }>

export interface DescriptorGenerator {
  (card: CardInstance): Descriptor
}

export interface Descriptor {
  text: string

  unbind(): void
}

export type DescriptorTable = {
  [key in string]: DescriptorGenerator
}

export type CardDescriptorTable = {
  [key in CardKey]?: string[]
}
