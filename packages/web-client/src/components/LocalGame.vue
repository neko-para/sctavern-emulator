<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { LocalGame, type GameReplay } from '@sctavern-emulator/emulator'
import GameInstanceChooser from './GameInstanceChooser.vue'
import {
  AllCard,
  AllUnit,
  getCard,
  getUnit,
  type Card,
  type Unit,
  type UnitKey,
} from '@sctavern-emulator/data'
import { compress, decompress } from '@/utils'
import type { ClientStatus } from './types'
import { WebClient } from './WebClient'

const props = defineProps<{
  replay: string
  interval: number
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

const replay = decompress(props.replay) as GameReplay

const game = new LocalGame({
  pack: replay.pack,
  seed: replay.seed,
  role: replay.role,
})

const client = new WebClient(game.slave, 0, status)

const replaying = ref(false)
const replayStatus = ref<'play' | 'pause'>('play')
let replayResolve: (() => void) | null = null

function pauseReplay() {
  replayStatus.value = 'pause'
}

function playReplay() {
  replayStatus.value = 'play'
  nextReplay()
}

function stopReplay() {
  replaying.value = false
}

function nextReplay() {
  if (replayResolve) {
    const r = replayResolve
    replayResolve = null
    r()
  }
}

async function main() {
  game.master.poll()
  game.slave.poll()
  game.slave.game.start()

  replaying.value = true
  await client.replay(replay, async () => {
    if (replayStatus.value === 'play') {
      await new Promise<void>(resolve => {
        // resolve()
        setTimeout(resolve, props.interval)
      })
    } else {
      await new Promise<void>(resolve => {
        replayResolve = resolve
      })
    }
    return !replaying.value
  })
  replaying.value = false
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

const obtainUnitDlg = ref(false)
const obtainUnitKey = ref('')
const obtainUnitCountStr = ref('1')
const obtainUnitCount = computed<number>(() => {
  return Number(obtainUnitCountStr.value) || 0
})

const obtainUnitChoice = computed(() => {
  return AllUnit.map(getUnit)
    .map(
      (u, i) =>
        [u, u.pinyin.indexOf(obtainUnitKey.value), i] as [Unit, number, number]
    )
    .filter(([u, x]) => x !== -1)
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return a[1] - b[1]
      } else {
        return a[2] - b[2]
      }
    })
    .map(([u]) => u)
    .slice(0, 10)
})

function handleKey(ev: KeyboardEvent) {
  if (
    status.model ||
    expDlg.value ||
    obtainCardDlg.value ||
    obtainUnitDlg.value
  ) {
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
    pack: replay.pack,
    seed: replay.seed,
    role: replay.role,
    log: game.slave.game.log,
  })
  expDlg.value = true
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
    v-model="obtainCardDlg"
    :class="{
      'w-50': !mobile,
    }"
  >
    <v-card>
      <v-card-text>
        <v-text-field
          hide-details
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

  <v-dialog
    v-model="obtainUnitDlg"
    :class="{
      'w-50': !mobile,
    }"
  >
    <v-card>
      <v-card-text>
        <div class="d-flex">
          <v-text-field
            hide-details
            v-model="obtainUnitKey"
            @keyup.enter="
              obtainUnitChoice.length > 0 &&
                client.status.selected[0] === 'P' &&
                client.requestObtainUnit(
                  Number(client.status.selected.substring(1)),
                  Array(Number(obtainUnitCount)).fill(
                    obtainUnitChoice[0].name
                  ) as UnitKey[]
                )
            "
          ></v-text-field>
          <v-text-field
            label="数量"
            :rules="[v => /^\d+$/.test(v) || '必须为数字']"
            v-model="obtainUnitCountStr"
          ></v-text-field>
        </div>
        <div class="d-flex flex-column">
          <v-btn
            variant="flat"
            v-for="(c, i) in obtainUnitChoice"
            :class="{
              enterSelect: i === 0,
            }"
            :key="`OUChoice-${i}`"
            @click="
              client.status.selected[0] === 'P' &&
                client.requestObtainUnit(
                  Number(client.status.selected.substring(1)),
                  Array(Number(obtainUnitCount)).fill(
                    obtainUnitChoice[i].name
                  ) as UnitKey[]
                )
            "
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
      <v-btn :disabled="status.model" @click="obtainCardDlg = true">卡牌</v-btn>
      <v-btn
        :disabled="status.model || client.status.selected[0] !== 'P'"
        @click="obtainUnitDlg = true"
        >单位</v-btn
      >
      <v-btn :disabled="status.model" @click="client.requestResource()"
        >资源</v-btn
      >
      <template v-if="replaying">
        <v-btn v-if="replayStatus === 'play'" @click="pauseReplay()"
          >暂停</v-btn
        >
        <template v-else>
          <v-btn @click="playReplay()">继续</v-btn>
          <v-btn @click="nextReplay()">单步</v-btn>
          <v-btn @click="stopReplay()">停止</v-btn>
        </template>
      </template>
    </div>
  </game-instance-chooser>
</template>

<style scoped></style>
