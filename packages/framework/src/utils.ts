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
    asString: true
  })
}
