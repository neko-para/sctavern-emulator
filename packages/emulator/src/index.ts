import type { GameConfig, GroupGameConfig, GameReplay, LogItem } from './types'
import { GameInstance } from './game'
import { Player } from './player'
import { CardInstance, type CardInstanceAttrib } from './card'
import { Shuffler } from './utils'
import {
  PlayerClient,
  type $MasterGame,
  type $SlaveGame,
  type $Client,
} from './client'
import type { InnerMsg, OutterMsg } from './events'

export type {
  LogItem,
  GameReplay,
  GameConfig,
  GroupGameConfig,
  CardInstanceAttrib,
  $MasterGame,
  $SlaveGame,
  $Client,
  InnerMsg,
  OutterMsg,
}
export { GameInstance, Player, CardInstance, Shuffler, PlayerClient }
