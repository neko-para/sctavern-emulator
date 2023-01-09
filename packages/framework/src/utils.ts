import { deflateRaw, inflateRaw } from 'pako'
import { Buffer } from 'buffer'
import md5 from 'md5'

export function Compress<T extends object>(obj: T) {
  return Buffer.from(deflateRaw(JSON.stringify(obj)))
    .toString('base64')
    .replace(/\//g, '$')
}

export function Decompress<T>(save: string): T | null {
  try {
    return JSON.parse(
      Buffer.from(
        inflateRaw(Buffer.from(save.replace(/\$/g, '/'), 'base64'))
      ).toString('utf-8')
    ) as T
  } catch {
    return null
  }
}

export function Md5(data: string): string {
  return md5(data, {
    asString: true,
  })
}

export class LCG {
  seed: number

  constructor(begin: number) {
    this.seed = begin
  }

  next() {
    this.seed = (25214903917 * this.seed) & ((1 << 48) - 1)
    return this.seed
  }

  nextReal() {
    // [0, 1)
    return this.next() / (1 << 48)
  }

  int(max: number, min = 0) {
    // [min, max]
    return min + this.nextReal() * (max - min + 1)
  }

  shuffle<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}
