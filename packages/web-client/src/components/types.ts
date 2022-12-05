import type { Card, UpgradeKey } from '@sctavern-emulator/data'

export interface ClientStatus {
  model: boolean
  discover: boolean
  deploy: boolean
  insert: boolean
  selected: string
  discoverItems: (Card | UpgradeKey)[]
  discoverCancel: boolean
}
