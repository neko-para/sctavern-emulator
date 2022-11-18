import { AhoCorasick } from 'ahocorasick-ts'

import type {
  Card,
  Term,
  Unit,
  Upgrade,
  Weapon,
  Armor,
  SArmor,
  SplitResult,
  SplitResultRefer,
} from './types'
import { data as raw, AllUnit } from './pubdata'
import type {
  CardKey,
  TermKey,
  UnitKey,
  UpgradeKey,
  PossibleKey,
} from './pubdata'
const { card, term, unit, upgrade, attr, tr, order } = raw

export const Cards: Map<CardKey, Card> = new Map()
export const Terms: Map<TermKey, Term> = new Map()
export const Units: Map<UnitKey, Unit> = new Map()
export const Upgrades: Map<UpgradeKey, Upgrade> = new Map()

export { attr, tr, order }
export { CardKey, TermKey, UnitKey, UpgradeKey, PossibleKey }
export { Card, Term, Unit, Upgrade, Weapon, Armor, SArmor }
export { SplitResult, SplitResultRefer }

card.forEach(c => Cards.set(c.name, c))
term.forEach(t => Terms.set(t.name, t))
unit.forEach(u => Units.set(u.name, u))
upgrade.forEach(u => Upgrades.set(u.name, u))

export function getCard(key: CardKey) {
  return Cards.get(key) as Card
}
export function getTerm(key: TermKey) {
  return Terms.get(key) as Term
}
export function getUnit(key: UnitKey) {
  return Units.get(key) as Unit
}
export function getUpgrade(key: UpgradeKey) {
  return Upgrades.get(key) as Upgrade
}
export function canElite(key: UnitKey) {
  return AllUnit.includes((key + '(精英)') as UnitKey)
}
export function elited(key: UnitKey) {
  return (key + '(精英)') as UnitKey
}
export function isBiological(key: UnitKey) {
  return getUnit(key).tag.includes('生物单位')
}
export function isMachine(key: UnitKey) {
  return getUnit(key).tag.includes('机械单位')
}
export function isHeavy(key: UnitKey) {
  return getUnit(key).tag.includes('机械单位')
}
export function isPsionic(key: UnitKey) {
  return getUnit(key).tag.includes('灵能单位')
}
export function isHero(key: UnitKey) {
  return getUnit(key).tag.includes('英雄单位')
}
export function isNormal(key: UnitKey) {
  return getUnit(key).utype === 'normal'
}
export function isSpecialBuilding(key: UnitKey) {
  return getUnit(key).utype === 'spbd'
}
export function isSpecialUnit(key: UnitKey) {
  return getUnit(key).utype === 'spun'
}

export const Keywords = Array.from(
  new Set<CardKey | TermKey | UnitKey | UpgradeKey>([
    ...Array.from(Cards.keys()),
    ...Array.from(Terms.keys()),
    ...Array.from(Units.keys()),
    ...Array.from(Upgrades.keys()),
  ]).keys()
)

const searcher = new AhoCorasick(Keywords)

function splitTextPiece(text: string) {
  let result: {
    start: number
    end: number
    word: string
    drop?: boolean
  }[] = searcher.search(text).map(res => {
    let r = ''
    res.keys.forEach(s => {
      if (s.length > r.length) {
        r = s
      }
    })
    return {
      start: res.end - r.length + 1,
      end: res.end,
      word: r,
    }
  })
  result.sort((a, b) => b.end - a.end)
  for (let i = 0; i < result.length; i++) {
    if (result[i].drop) {
      continue
    }
    const outer = result[i]
    for (let j = i + 1; j < result.length; j++) {
      if (
        !result[j].drop &&
        outer.start <= result[j].start &&
        result[j].end <= outer.end
      ) {
        result[j].drop = true
      }
    }
  }
  result = result.filter(r => !r.drop)
  result.sort((a, b) => a.end - b.end)

  let ps = 0
  const secs: SplitResult = []
  result.forEach(res => {
    if (ps < res.start) {
      secs.push({
        t: 'str',
        s: text.substring(ps, res.start),
      })
    }
    secs.push({
      t: 'ref',
      s: res.word as PossibleKey,
    })
    ps = res.end + 1
  })
  if (ps < text.length) {
    secs.push({
      t: 'str',
      s: text.substring(ps),
    })
  }
  return secs
}

export function splitText(text: string) {
  const result: SplitResult = []
  text.split(/(?=<.+?>)|(?<=<.+?>)/).forEach(s => {
    const m = /<(.+?)>/.exec(s)
    if (m) {
      result.push(
        ...splitTextPiece(m[1]).map(n => {
          n.m = true
          return n
        })
      )
    } else {
      result.push(...splitTextPiece(s))
    }
  })
  return result
}
