import { Signal } from './signal'

export interface IWebSocket {
  recv: Signal<string>
  send: Signal<string>

  status: Signal<'open' | 'close'>
  ctrl: Signal<'close'>
}

export interface IWebSocketServer {
  connected: Signal<IWebSocket>

  status: Signal<'listening' | 'close'>
  ctrl: Signal<'close'>
}

export type IWebSocketClientFactory = (url: string) => IWebSocket
export type IWebSocketServerFactory = (port: number) => IWebSocketServer
