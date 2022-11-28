import type { GameConfig } from './types'
import { Game, type LogItem, type GameReplay } from './game'
import { Player } from './player'
import { CardInstance, type CardInstanceAttrib } from './card'
import { Shuffler } from './utils'
import { Client, Adapter, SlaveGame, MasterGame, LocalGame } from './client'

export type { LogItem, GameReplay, GameConfig, CardInstanceAttrib, Adapter }
export {
  Game,
  Player,
  CardInstance,
  Shuffler,
  Client,
  SlaveGame,
  MasterGame,
  LocalGame,
}
