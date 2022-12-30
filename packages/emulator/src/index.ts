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

export type {
  LogItem,
  GameReplay,
  GameConfig,
  CardInstanceAttrib,
  $MasterGame,
  $SlaveGame,
  $Client,
}
export { GameInstance, Player, CardInstance, Shuffler, PlayerClient, LocalGame }
