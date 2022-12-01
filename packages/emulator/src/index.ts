import type { GameConfig, GameReplay, InputBus, LogItem } from './types.js'
import { Game } from './game.js'
import { Player } from './player.js'
import { CardInstance, type CardInstanceAttrib } from './card.js'
import { Shuffler } from './utils.js'
import {
  type Adapter,
  Client,
  SlaveGame,
  MasterGame,
  LocalGame,
} from './client.js'

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
