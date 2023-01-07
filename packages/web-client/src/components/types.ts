import type { Card, Upgrade } from '@sctavern-emulator/data'
import type { GroupGameConfig } from '@sctavern-emulator/emulator'

export interface ClientStatus {
  model: boolean
  discover: boolean
  deploy: boolean
  insert: boolean
  selected: string
  discoverItems: (Card | Upgrade | string)[]
  discoverExtra: string | null
}

export interface RemoteOption {
  target: string
  game: string
  id: string
  pos: number
  config: GroupGameConfig
}
