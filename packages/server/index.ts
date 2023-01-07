import fs from 'fs/promises'
import { GroupServer, Signal } from '@sctavern-emulator/framework'
import { GameConfig, type InnerMsg } from '@sctavern-emulator/emulator'
import { serverFactory } from './websock'

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

endSig.connect(async () => {
  const server = await pServer
  await fs.writeFile('user.txt', server.save())
})

const pServer = GroupServer.create<
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

fs.stat('user.txt')
  .then(() => {
    fs.readFile('user.txt')
      .then(v => v.toString())
      .then(data => pServer.then(s => s.load(data)))
  })
  .catch(e => void 0)
