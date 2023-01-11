import { clientFactory, serverFactory } from './websock'
import {
  GroupServer,
  Signal,
  RemoteGame,
  type Game,
  SlaveGame,
  type Client,
  GroupClient,
} from '../src'

process.stdin.setRawMode(true)
const endSig = new Signal<true>()

process.stdin.on('data', chunk => {
  const arr = Uint8Array.from(chunk)
  console.log(arr)
  if (arr.length === 1 && arr[0] === 0x1b) {
    endSig.emit(true)
  }
})

endSig.connect(async () => {
  process.stdin.setRawMode(false)
  setTimeout(() => {
    process.exit(0)
  }, 500)
})

class IM implements Game<string, string> {
  slave: SlaveGame<string, string, IM>
  $game: Signal<string>
  $client: Signal<string>

  constructor(s: SlaveGame<string, string, IM>) {
    this.slave = s
    this.$game = new Signal()
    this.$client = new Signal()
    this.$game.connect(this.$client)
  }
}

class IMC implements Client<string, string, IM> {
  slave: SlaveGame<string, string, IM>
  $send: Signal<string>
  $recv: Signal<string>

  constructor(s: SlaveGame<string, string, IM>) {
    this.slave = s
    this.$send = new Signal()
    this.$recv = new Signal()
  }
}

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function client_Owner() {
  const client = await GroupClient.create<{
    min_players: number
    max_players: number
  }>(clientFactory, 'localhost', 8080)

  client.gameStarted.connect(async ({ target, port, id, game, pos }) => {
    console.log(game, pos)
    new RemoteGame<string, string, IM>(
      s => new IM(s),
      clientFactory,
      `ws://${target}:${port}`,
      id,
      game,
      slave => {
        slave.bind(s => {
          const c = new IMC(s)
          setTimeout(() => {
            c.$send.emit('Hello from nekosu')
          }, 1000)
          return c
        })
      }
    )
  })

  endSig.connect(async () => {
    client.client.close()
  })

  await client.register('nekosu', '123456').then(v => v.unwrap())
  await client.new_group().then(v => v.unwrap())
  while ((client.data.group?.player.length || 1) < 2) {
    await delay(200)
  }
  await client.start_game().then(v => v.unwrap())
}

async function client_One() {
  const client = await GroupClient.create<{
    min_players: number
    max_players: number
  }>(clientFactory, 'localhost', 8080)

  client.gameStarted.connect(async ({ target, port, id, game, pos }) => {
    console.log(game, pos)
    new RemoteGame<string, string, IM>(
      s => new IM(s),
      clientFactory,
      `ws://${target}:${port}`,
      id,
      game,
      slave => {
        slave.bind(s => {
          const c = new IMC(s)
          setTimeout(() => {
            c.$send.emit('Hello from 6658')
          }, 1500)
          c.$recv.connect(async item => {
            console.log('6658:', item)
          })
          return c
        })
      }
    )
  })

  endSig.connect(async () => {
    client.client.close()
  })

  await client.register('6658', '123456').then(v => v.unwrap())
  while (client.data.group_list.length === 0) {
    await delay(200)
  }
  await client.enter_group(client.data.group_list[0].id).then(v => v.unwrap())
}

async function main() {
  const server = await GroupServer.create<
    {
      min_players: number
      max_players: number
    },
    string
  >(serverFactory, 8080, {
    min_players: 2,
    max_players: 2,
  })

  console.log('server started')
  endSig.connect(async () => {
    server.server.close()
  })

  await Promise.all([client_Owner(), client_One()])
}

main()
