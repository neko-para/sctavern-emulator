import {
  Card,
  CardKey,
  RoleKey,
  UnitKey,
  Upgrade,
  UpgradeKey,
} from '@sctavern-emulator/data'
import { CardInstance } from './card'
import { Emitter } from './emitter'

type ApplyKey<T, I extends Record<string, unknown>> = {
  [key in keyof T]: T[key] & I
}

type InputBusTemplate = {
  $upgrade: {
    //
  }
  $refresh: {
    //
  }
  $done: {
    //
  }
  $ability: {
    //
  }
  $lock: {
    //
  }
  $unlock: {
    //
  }

  $select: {
    choice: string
  }
  '$insert-choice': {
    choice: number
  }
  '$discover-choice': {
    choice: number
  }
  '$deploy-choice': {
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
  '$obtain-unit': {
    place: number
    units: UnitKey[]
  }
  $imr: {
    //
  }
}

export type InputBus = ApplyKey<InputBusTemplate, { player: number }>

type GameBus = {
  'round-start': {
    round: number
  }
  'round-enter': {
    // 操作前的时间点, 用于各个角色的技能
    round: number
  }
  'round-end': {
    round: number
  }
  'round-finish': {
    // 回合结束后时间点, 用于混合体
    round: number
  }
}

type PlayerBusTemplate = {
  'tavern-upgraded': {
    // 升级酒馆
    level: number
  }
  refreshed: {
    // 刷新商店
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
    flag: boolean // 仅用于光复艾尔, 防止重复回收, 考虑换其它方法
    pos: number
  }
  'upgrade-cancelled': {
    target: CardInstance
  }

  seize: {
    // 夺取
    target: CardInstance
    from: CardInstance
  }
  'task-done': {
    target: CardInstance
  }
  'infr-changed': {
    // 挂件切换
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
  'obtain-upgrade': {
    upgrade: UpgradeKey
  }

  'fast-prod': {
    // 快速生产
  }

  req_incubate: {
    id: number
  }

  regroup: {
    // 集结
    id: number
  }

  'gain-darkness': {
    // 获得黑暗值
    dark: number
  }

  'post-enter': {
    //
  }
  'post-sell': {
    pos: number // 用于供养等, 定位
  }
  'post-deploy': {
    target: CardInstance
  }
}

type CardBus = ApplyKey<
  CardBusTemplate,
  { player: number; card: number | Emitter<LogicBus> }
>

export type LogicBus = GameBus & PlayerBus & CardBus & InputBus

type OutputBusTemplate = {
  refresh: {
    //
  }
  selected: {
    choice: string
  }
  'begin-insert': {
    //
  }
  'end-insert': {
    //
  }
  'begin-discover': {
    item: (Card | Upgrade | string)[]
    extra?: string
  }
  'end-discover': {
    //
  }
  'begin-deploy': {
    //
  }
  'end-deploy': {
    //
  }
}

export type OutputBus = ApplyKey<OutputBusTemplate, { client: number }>

export interface DescriptorGenerator {
  (card: CardInstance, gold: boolean): Descriptor // 白球之类的导致不能单纯靠卡牌属性来判断是否为金色
}

export interface Descriptor {
  gold: boolean
  unique?: string
  uniqueNoGold?: boolean // 用于信标, 光复等提示, 无视金色的覆盖效果
  manualDisable?: boolean // 是否启用, 用于光复
  disabled?: boolean

  unbind?(): void
}

export interface DescriptorInfo {
  text: string
  desc: Descriptor
  bind: (card: CardInstance) => Descriptor
  data: {
    desc: DescriptorGenerator
    text: [string, string]
  }
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

export const AllMutations = [
  '辅助角色-诺娃',
  '辅助角色-星港',
  '辅助角色-泰凯斯',
  '地嗪外溢',
  '作战规划',
]

export const MutationPreventRole: Partial<Record<MutationKey, RoleKey>> = {
  '辅助角色-诺娃': '诺娃',
  '辅助角色-星港': '星港',
  '辅助角色-泰凯斯': '泰凯斯',
  地嗪外溢: '斯台特曼',
}

export type MutationKey =
  | '辅助角色-诺娃'
  | '辅助角色-星港'
  | '辅助角色-泰凯斯'
  | '地嗪外溢'
  | '作战规划'

export interface GameConfig {
  pack: string[]
  seed: string
  role: RoleKey[]
  mutation: MutationKey[]
}

export interface LogItem {
  msg: string
  param: Record<string, unknown>
}

export interface GameReplay extends GameConfig {
  pack: string[]
  seed: string
  role: RoleKey[]
  log: LogItem[]
}

export interface Postable<Bus> {
  post<T extends keyof Bus>(msg: T, param: Bus[T]): Promise<void>
}
