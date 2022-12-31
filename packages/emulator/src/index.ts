import type { GameConfig, GameReplay, LogItem } from './types'
import { GameInstance } from './game'
import { Player } from './player'
import { CardInstance, type CardInstanceAttrib } from './card'
import { Shuffler } from './utils'
import {
  LocalGame,
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
  CardInstanceAttrib,
  $MasterGame,
  $SlaveGame,
  $Client,
  InnerMsg,
  OutterMsg,
}
export { GameInstance, Player, CardInstance, Shuffler, PlayerClient, LocalGame }
