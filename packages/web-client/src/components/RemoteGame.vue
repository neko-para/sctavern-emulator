<script setup lang="ts">
import { reactive } from 'vue'
import { SlaveGame } from '@nekosu/game-framework'
import { GameInstance, type $SlaveGame } from '@sctavern-emulator/emulator'
import GameInstanceChooser from './GameInstanceChooser.vue'
import type { ClientStatus } from './types'
import { WebClient } from './WebClient'

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
  discoverExtra: null,
})

const game: $SlaveGame = new SlaveGame(
  sg =>
    new GameInstance(
      {
        pack: ['核心'],
        seed: '1',
        role: ['SCV', '副官'],
        mutation: [],
      },
      sg
    )
)

// game.getClientConnection()

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
        client.post({
          msg: '$select',
          area: 'present',
          choice: pos,
        })
      } else {
        client.post({
          msg: '$select',
          area: 'none',
          choice: -1,
        })
      }
      break
    }
    default: {
      for (const act of client.player.data.globalActs) {
        if (ev.key === act.accelerator && act.enable) {
          client.post(act.message)
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
          client.post(act.message)
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
