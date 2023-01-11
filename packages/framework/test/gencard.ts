import { AllCard, getCard } from '@sctavern-emulator/data'
import fs from 'fs/promises'

const ct = {
  normal: 'normal',
  building: 'structure',
  support: 'support',
}

const res = {}

AllCard.forEach(c => {
  const card = getCard(c)
  const r = {
    pinyin: card.pinyin,
    race: card.race,
    level: card.level,
    pack: card.pack,
    unit: card.unit,
    attr: (() => {
      const res = {}
      if (card.pool) {
        res['pool'] = true
      }
      if (card.attr.rare) {
        res['rare'] = true
      }
      if (card.attr.gold) {
        res['darkgold'] = true
      }
      if (card.attr.insert) {
        res['insert'] = true
      }
      return res
    })(),
    belong: card.attr.origin
      ? 'primal'
      : card.attr.dark
      ? 'dark'
      : card.attr.void
      ? 'virtual'
      : 'none',
    type: ct[card.attr.type || 'normal'],
    desc: card.desc,
  }
  if (card.banner) {
    r['banner'] = card.banner
  }
  res[c] = r
})

fs.writeFile(
  'card.js',
  `
import { Card } from './types'

export type CardKey = 
${AllCard.map(c => `  | '${c}'\n`).join('')}

export const AllCard = [
  ${AllCard.map(c => `'${c}', `).join('')}
]

export const CardData: Record<CardKey, Card> = ${JSON.stringify(res, null, 2)}

`
)
