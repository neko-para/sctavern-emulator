import { CardKey, MutationKey, RoleKey } from '@sctavern-emulator/data'
import { CardInstance } from './card'
import { InputMsg } from './events'

export type GameArea = 'none' | 'hand' | 'store' | 'present'
export type ObtainUnitWay = 'normal' | 'incubate' | 'wrap'

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

export interface GameConfig {
  pack: string[]
  seed: string
  role: RoleKey[]
  mutation: MutationKey[]
}

export type LogItem = InputMsg

export interface GameReplay extends GameConfig {
  pack: string[]
  seed: string
  role: RoleKey[]
  log: LogItem[]
}

export interface Postable<Bus> {
  post<T extends keyof Bus>(msg: T, param: Bus[T]): Promise<void>
}

export type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never
