import { AllMutation, getMutation } from '@sctavern-emulator/data'
import fs from 'fs/promises'

const res = {}

AllMutation.forEach(u => {
  const mut = getMutation(u)
  const r = {
    pinyin: mut.pinyin,
  }
  if (mut.prole) {
    r['prevent'] = mut.prole
  }
  res[u] = r
})

fs.writeFile(
  'mutation.js',
  `
import type { Mutation } from './types'

export type MutationKey = 
${AllMutation.map(c => `  | '${c}'\n`).join('')}

export const AllMutation = [
  ${AllMutation.map(c => `'${c}', `).join('')}
]

export const MutationData: Record<MutationKey, Mutation> = ${JSON.stringify(
    res,
    null,
    2
  )}

`
)
