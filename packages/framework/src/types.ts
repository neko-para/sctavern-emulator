import type { Signal } from './signal'
import type { SlaveGame } from './slave'

export interface Game<InputMessage, OutputMessage> {
  slave: SlaveGame<
    InputMessage,
    OutputMessage,
    Game<InputMessage, OutputMessage>
  >
  $game: Signal<InputMessage>
  $client: Signal<OutputMessage>
}

export interface Client<
  InputMessage,
  OutputMessage,
  G extends Game<InputMessage, OutputMessage>
> {
  slave: SlaveGame<InputMessage, OutputMessage, G>
  $send: Signal<InputMessage>
  $recv: Signal<OutputMessage>
}
