<script setup lang="ts">
import { reactive } from 'vue'
import { SlaveGame } from '@sctavern-emulator/emulator'
import GameInstanceChooser from './GameInstanceChooser.vue'
import type { ClientStatus } from './types'
import { ClientAdapter, WebClient } from './WebClient'

const props = defineProps<{
  target: string
  pos: number
  mobile: boolean
}>()

const status = reactive<ClientStatus>({
  model: false,
  discover: false,
  deploy: false,
  insert: false,
  selected: 'none',
  discoverItems: [],
  discoverCancel: false,
})

const game = new SlaveGame(
  {
    pack: ['核心'],
    seed: '1',
    role: ['SCV', '副官'],
  },
  new ClientAdapter(() => {
    game.game.start()
  })
)

const client = new WebClient(game, props.pos, status)

async function main() {
  game.poll()
}

function handleKey(ev: KeyboardEvent) {
  if (status.model) {
    return
  }
  switch (ev.key) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7': {
      const pos = Number(ev.key) - 1
      if (client.player.data.present[pos]) {
        client.selectChoose(`P${pos}`)
      } else {
        client.selectChoose('none')
      }
      break
    }
    default: {
      for (const act of client.player.data.globalActs) {
        if (ev.key === act.accelerator && act.enable) {
          client.post(act.message, {
            player: client.pos,
          })
        }
      }
      const m = /^([HSP])(\d)$/.exec(status.selected)
      if (!m) {
        return
      }
      const stype = m[1] as 'H' | 'S' | 'P'
      const pos = Number(m[2])
      const acts = (() => {
        switch (stype) {
          case 'H':
            return client.player.data.handActs[pos]
          case 'S':
            return client.player.data.storeActs[pos]
          case 'P':
            return client.player.data.presentActs[pos]
        }
      })()
      for (const act of acts) {
        if (ev.key === act.accelerator && act.enable) {
          client.post(act.message, {
            player: client.pos,
            place: pos,
          })
        }
      }
    }
  }
}

document.onkeydown = handleKey

main()
</script>

<template>
  <game-instance-chooser :mobile="mobile" :status="status" :client="client">
    <span>
      {{ game.game.player[0].data.value }},
      {{ game.game.player[1].data.value }}
    </span>
  </game-instance-chooser>
</template>
