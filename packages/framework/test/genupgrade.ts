import {
  AllCard,
  AllUpgrade,
  getCard,
  getUpgrade,
} from '@sctavern-emulator/data'
import fs from 'fs/promises'

const ct = {
  S: 'special',
  '3': 'combine',
  T: 'terran',
  P: 'protoss',
  Z: 'zerg',
  C: 'public',
  V: 'virtual',
  O: 'primal',
}

const res = {}

AllUpgrade.forEach(u => {
  const upg = getUpgrade(u)
  const r = {
    pinyin: upg.pinyin,
    override: upg.override,
    category: ct[upg.category],
  }
  res[u] = r
})

fs.writeFile(
  'upgrade.js',
  `
import type { Upgrade } from './types'

export type UpgradeKey = 
${AllUpgrade.map(c => `  | '${c}'\n`).join('')}

export const AllUpgrade = [
  ${AllUpgrade.map(c => `'${c}', `).join('')}
]

export const UpgradeData: Record<UpgradeKey, Upgrade> = ${JSON.stringify(
    res,
    null,
    2
  )}

`
)
