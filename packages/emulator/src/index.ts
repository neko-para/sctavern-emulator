import type { GameConfig, GameReplay, InputBus, LogItem } from './types'
import { Game } from './game'
import { Player } from './player'
import { CardInstance, type CardInstanceAttrib } from './card'
import { Shuffler } from './utils'
import {
  type Adapter,
  Client,
  SlaveGame,
  MasterGame,
  LocalGame,
} from './client'

export type {
  LogItem,
  GameReplay,
  GameConfig,
  InputBus,
  CardInstanceAttrib,
  Adapter,
}
export {
  Game,
  Player,
  CardInstance,
  Shuffler,
  Client,
  LocalGame,
  SlaveGame,
  MasterGame,
}
