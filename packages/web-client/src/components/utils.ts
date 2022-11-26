import { deflateRaw, inflateRaw } from 'pako'
import { Buffer } from 'buffer'
import type { GameConfig } from 'emulator'

export function compress(obj: any) {
  return Buffer.from(deflateRaw(JSON.stringify(obj))).toString('base64')
}

export function decompress(save: string) {
  return JSON.parse(
    Buffer.from(inflateRaw(Buffer.from(save, 'base64'))).toString('utf-8')
  )
}

export function applyConfigChange(config: GameConfig, replay?: string) {
  const param = new URLSearchParams({
    pack: config.pack.join(','),
    seed: config.seed,
    role: config.role[0],
  })
  if (replay) {
    param.set('replay', replay)
  }
  window.location.href = '/sctavern-emulator/?' + param.toString()
}
