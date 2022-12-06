import { deflateRaw, inflateRaw } from 'pako'
import { Buffer } from 'buffer'

export function compress(obj: any) {
  return Buffer.from(deflateRaw(JSON.stringify(obj))).toString('base64')
}

export function decompress(save: string) {
  return JSON.parse(
    Buffer.from(inflateRaw(Buffer.from(save, 'base64'))).toString('utf-8')
  )
}

export function isMobile() {
  const agent = navigator.userAgent
  return (
    agent.indexOf('Android') > -1 ||
    agent.indexOf('iPhone') > -1 ||
    agent.indexOf('iPad') > -1 ||
    agent.indexOf('iPod') > -1 ||
    agent.indexOf('Symbian') > -1
  )
}
