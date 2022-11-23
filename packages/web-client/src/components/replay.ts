import type { LogItem } from 'emulator'
import { deflateRaw, inflateRaw } from 'pako'
import { Buffer } from 'buffer'

export interface GameReplay {
  pack: string[]
  seed: string
  log: LogItem[]
}

export function encodeSave(replay: GameReplay) {
  return Buffer.from(deflateRaw(JSON.stringify(replay))).toString('base64')
}

export function decodeSave(save: string) {
  return JSON.parse(
    Buffer.from(inflateRaw(Buffer.from(save, 'base64'))).toString('utf-8')
  ) as GameReplay
}
