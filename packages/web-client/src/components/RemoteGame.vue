<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RemoteGame, SlaveGame } from '@sctavern-emulator/framework'
import {
  GameInstance,
  type GroupGameConfig,
  type InnerMsg,
  type OutterMsg,
} from '@sctavern-emulator/emulator'
import GameInstanceChooser from './GameInstanceChooser.vue'
import type { ClientStatus } from './types'
import { WebClient } from './WebClient'
import { clientFactory } from '@/websock'

const props = defineProps<{
  target: string
  game: string
  id: string
  pos: number
  config: GroupGameConfig
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

const rgame = ref<RemoteGame<InnerMsg, OutterMsg, GameInstance> | null>(null)
const client = ref<WebClient | null>(null)

async function main() {
  const s = await new Promise<SlaveGame<InnerMsg, OutterMsg, GameInstance>>(
    resolve => {
      rgame.value = new RemoteGame<InnerMsg, OutterMsg, GameInstance>(
        sg => new GameInstance(props.config, sg),
        clientFactory,
        props.target,
        props.id,
        props.game,
        sg => {
          sg.game.start()
          resolve(sg)
        }
      )
    }
  )
  client.value = s.bind(sg => new WebClient(sg, props.pos, status)) as WebClient
}

main()

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
      if (client.value?.player.data.present[pos]) {
        client.value?.post({
          msg: '$select',
          area: 'present',
          choice: pos,
        })
      } else {
        client.value?.post({
          msg: '$select',
          area: 'none',
          choice: -1,
        })
      }
      break
    }
    default: {
      for (const act of client.value?.player.data.globalActs || []) {
        if (ev.key === act.accelerator && act.enable) {
          client.value?.post(act.message)
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
            return client.value?.player.data.handActs[pos]
          case 'S':
            return client.value?.player.data.storeActs[pos]
          case 'P':
            return client.value?.player.data.presentActs[pos]
        }
      })()
      for (const act of acts || []) {
        if (ev.key === act.accelerator && act.enable) {
          client.value?.post(act.message)
        }
      }
    }
  }
}

document.onkeydown = handleKey
</script>

<template>
  <game-instance-chooser
    v-if="client"
    :mobile="mobile"
    :status="status"
    :client="(client as WebClient)"
  >
    <span>
      {{ rgame?.slave?.game.player[0].data.value }},
      {{ rgame?.slave?.game.player[1].data.value }}
    </span>
  </game-instance-chooser>
</template>
