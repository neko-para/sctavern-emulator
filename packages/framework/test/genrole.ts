import {
  AllCard,
  AllRole,
  AllUpgrade,
  getCard,
  getRole,
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

AllRole.forEach(u => {
  const role = getRole(u)
  const r = {
    pinyin: role.pinyin,
    ability: role.ability,
    desc: role.desc,
  }
  if (role.ext) {
    r['ext'] = true
  }
  res[u] = r
})

fs.writeFile(
  'role.js',
  `
import type { Role } from './types'

export type RoleKey = 
${AllRole.map(c => `  | '${c}'\n`).join('')}

export const AllRole = [
  ${AllRole.map(c => `'${c}', `).join('')}
]

export const RoleData: Record<RoleKey, Role> = ${JSON.stringify(res, null, 2)}

`
)
