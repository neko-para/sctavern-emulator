import { AllUnit, getUnit } from '@sctavern-emulator/data'
import fs from 'fs/promises'

const ur = {
  normal: 'normal',
  spun: 'special unit',
  spbd: 'special structure',
}

const tr = {
  轻甲: 'light',
  重甲: 'armored',
  生物单位: 'biological',
  机械单位: 'mechanical',
  重型单位: 'massive',
  英雄单位: 'heroic',
  建筑: 'structure',
  灵能单位: 'psionic',
  召唤: 'summoned',
}

const res = {}

AllUnit.forEach(u => {
  const unit = getUnit(u)
  const r = {
    pinyin: unit.pinyin,
    race: unit.race,
    value: unit.value,
    type: ur[unit.utype],
    tag: (() => {
      const res = {}
      unit.tag.forEach(t => (res[tr[t] || t] = true))
      if (unit.air) {
        res['air'] = true
      }
      return res
    })(),
    health: unit.health,
  }
  if (unit.shield) {
    r['shield'] = unit.shield
  }
  res[u] = r
})

fs.writeFile(
  'unit.js',
  `
import { Unit, UnitType } from './types'

export type UnitKey = 
${AllUnit.map(u => `  | '${u}'\n`).join('')}

export const AllUnit = [
  ${AllUnit.map(u => `'${u}', `).join('')}
]

export const UnitData: Record<UnitKey, Unit> = ${JSON.stringify(res, null, 2)}

`
)
