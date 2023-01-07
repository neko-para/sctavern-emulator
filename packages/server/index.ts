import { GroupServer } from '@sctavern-emulator/framework'
import { GameConfig, type InnerMsg } from '@sctavern-emulator/emulator'
import { serverFactory } from './websock'

GroupServer.create<
  {
    min_players: number
    max_players: number
  } & GameConfig,
  InnerMsg
>(serverFactory, 8080, {
  min_players: 2,
  max_players: 2,
  pack: ['核心'],
  role: ['白板', '白板'],
  seed: '1',
  mutation: [],
})
