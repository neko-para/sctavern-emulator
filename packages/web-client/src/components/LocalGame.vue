<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { LocalGame, type GameReplay } from '@sctavern-emulator/emulator'
import GameInstanceChooser from './GameInstanceChooser.vue'
import ConfigDialog from './ConfigDialog.vue'
import {
  AllCard,
  getCard,
  type Card,
  type RoleKey,
} from '@sctavern-emulator/data'
import { applyConfigChange, compress, decompress } from './utils'
import type { ClientStatus } from './types'
import { WebClient } from './WebClient'

const props = defineProps<{
  pack: string[]
  seed: string
  role: RoleKey
  replay: string | null
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

const game = new LocalGame({
  pack: props.pack,
  seed: props.seed,
  role: [props.role],
})

const client = new WebClient(game.slave, 0, status)

async function main() {
  game.master.poll()
  game.slave.poll()
  game.slave.game.start()
  if (props.replay) {
    const obj = decompress(props.replay) as GameReplay
    await client.replay(obj, async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 100)
      })
      return false
    })
  }
}

const obtainCardDlg = ref(false)
const obtainCardKey = ref('')

const obtainCardChoice = computed(() => {
  return AllCard.map(getCard)
    .map(
      (c, i) =>
        [c, c.pinyin.indexOf(obtainCardKey.value), i] as [Card, number, number]
    )
    .filter(([c, x]) => x !== -1)
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return a[1] - b[1]
      } else {
        return a[2] - b[2]
      }
    })
    .map(([c]) => c)
    .slice(0, 10)
})

function handleKey(ev: KeyboardEvent) {
  if (status.model || expDlg.value || impDlg.value || obtainCardDlg.value) {
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

const expDlg = ref(false)
const expData = ref('')

function doExport() {
  expData.value = compress({
    pack: props.pack,
    seed: props.seed,
    role: [props.role],
    log: game.slave.game.log,
  })
  expDlg.value = true
}

const impDlg = ref(false)
const impData = ref('')

function doImport() {
  const obj = decompress(impData.value) as GameReplay
  applyConfigChange(obj, impData.value)
}

document.onkeydown = handleKey

main()
</script>

<template>
  <v-dialog
    v-model="expDlg"
    :class="{
      'w-50': !mobile,
    }"
  >
    <v-card>
      <v-card-title>导出</v-card-title>
      <v-card-text>
        <v-textarea readonly hide-details v-model="expData"></v-textarea>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="impDlg"
    :class="{
      'w-50': !mobile,
    }"
  >
    <v-card>
      <v-card-title>导入</v-card-title>
      <v-card-text>
        <v-textarea hide-details v-model="impData"></v-textarea>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="doImport()">导入</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="obtainCardDlg"
    :class="{
      'w-50': !mobile,
    }"
  >
    <v-card>
      <v-card-text>
        <v-text-field
          hide-details
          autofocus
          v-model="obtainCardKey"
          @keyup.enter="
            obtainCardChoice.length > 0 &&
              client.requestObtainCard(obtainCardChoice[0].name)
          "
        ></v-text-field>
        <div class="d-flex flex-column">
          <v-btn
            variant="flat"
            v-for="(c, i) in obtainCardChoice"
            :class="{
              enterSelect: i === 0,
            }"
            :key="`OCChoice-${i}`"
            @click="client.requestObtainCard(c.name)"
            >{{ c.pinyin }} {{ c.name }}</v-btn
          >
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <game-instance-chooser :mobile="mobile" :status="status" :client="client">
    <div
      class="d-flex justify-space-between"
      :class="{
        'flex-column': mobile,
        'pr-2': !mobile,
      }"
    >
      <v-btn :disabled="status.model" @click="doExport()">导出</v-btn>
      <v-btn :disabled="status.model" @click="impDlg = true">导入</v-btn>
      <config-dialog :mobile="mobile"></config-dialog>

      <v-btn :disabled="status.model" @click="obtainCardDlg = true"
        >获取卡牌</v-btn
      >
      <v-btn :disabled="status.model" @click="client.requestResource()"
        >获得资源</v-btn
      >
    </div>
  </game-instance-chooser>
</template>

<style scoped></style>
