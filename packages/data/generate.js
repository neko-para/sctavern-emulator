const { parse } = require('@ltd/j-toml')
const fs = require('fs/promises')

async function searchDataRecursive(res, path) {
  for (const d of await fs.readdir(path)) {
    if (d.endsWith('.toml')) {
      res.push(`${path}/${d}`)
      continue
    }
    if ((await fs.stat(`${path}/${d}`)).isDirectory()) {
      await searchDataRecursive(res, `${path}/${d}`)
    }
  }
}

async function readAll(root) {
  const files = []
  await searchDataRecursive(files, root)
  const data = (await Promise.all(files.map(p => fs.readFile(p))))
    .map(b => b.toString())
    .join('\n')
  return parse(data, 1, '\n', false)
}

function splitDesc(str) {
  const d1 = []
  const d3 = []
  str.split(/(?={.*?\|.*?})|(?<={.*?\|.*?})/).forEach(node => {
    const m = /{(.*?)\|(.*?)}/.exec(node)
    if (m) {
      if (m[1].length > 0) {
        d1.push(`<${m[1]}>`)
      }
      if (m[2].length > 0) {
        d3.push(`<${m[2]}>`)
      }
    } else {
      d1.push(node)
      d3.push(node)
    }
  })
  return [d1.join(''), d3.join('')]
}

async function main() {
  const result = await readAll('.')
  ;['card', 'unit', 'term', 'upgrade'].forEach(k =>
    result[k].forEach(obj => {
      obj.type = k
    })
  )
  result.card.forEach(c => {
    c.desc = c.desc.map(splitDesc)
  })
  await fs.writeFile(
    process.argv[2],
    `import { Data } from "./types"
export type UnitKey = "${result.unit.map(x => x.name).join('"|"')}"
export const AllUnit: UnitKey[] = ["${result.unit
      .map(x => x.name)
      .join('","')}"]
export type CardKey = "${result.card.map(x => x.name).join('"|"')}"
export const AllCard: CardKey[] = ["${result.card
      .map(x => x.name)
      .join('","')}"]
export type TermKey = "${result.term.map(x => x.name).join('"|"')}"
export const AllTerm: TermKey[] = ["${result.term
      .map(x => x.name)
      .join('","')}"]
export type UpgradeKey = "${result.upgrade.map(x => x.name).join('"|"')}"
export const AllUpgrade: UpgradeKey[] = ["${result.upgrade
      .map(x => x.name)
      .join('","')}"]
export type PossibleKey = UnitKey | CardKey | TermKey | UpgradeKey
const data: Data = ${JSON.stringify(result, null, 2)}
export { data }\n`
  )
}

main()
