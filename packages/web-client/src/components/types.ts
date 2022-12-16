import type { Card, Upgrade } from '@sctavern-emulator/data'

export interface ClientStatus {
  model: boolean
  discover: boolean
  deploy: boolean
  insert: boolean
  selected: string
  discoverItems: (Card | Upgrade | string)[]
  discoverExtra: string | null
}
