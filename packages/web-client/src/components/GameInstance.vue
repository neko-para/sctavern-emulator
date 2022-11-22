<script setup lang="ts">
import { ref } from 'vue'
import { Game, Shuffler } from 'emulator'
import StoreItem from './StoreItem.vue'
import HandItem from './HandItem.vue'
import PresentItem from './PresentItem.vue'
import DiscoverItem from './DiscoverItem.vue'
import type { CardKey, UpgradeKey } from 'data'

const props = defineProps<{
  pack: string[]
  seed: string
}>()

const model = ref(false)
const insert = ref(false)
const discover = ref(false)
const discoverItems = ref<(CardKey | UpgradeKey)[]>([])
const discoverCancel = ref(false)

const packConfig: Record<string, boolean> = {}

props.pack.forEach(s => {
  packConfig[s] = true
})

const game = new Game(packConfig, new Shuffler(props.seed))
const player = game.player[0]

const timeTick = ref(0)

game.obus.on('refresh', async () => {
  console.log('refreshed')
  timeTick.value += 1
})

game.obus.on('begin-insert', async () => {
  insert.value = true
  model.value = true
})

game.obus.on('end-insert', async () => {
  insert.value = false
  model.value = false
})

game.obus.on('begin-discover', async ({ item, cancel }) => {
  discover.value = true
  discoverItems.value = item
  discoverCancel.value = cancel
  model.value = true
})

game.obus.on('end-discover', async () => {
  discover.value = false
  discoverItems.value = []
  discoverCancel.value = false
  model.value = false
})

game.start()

function requestHand({
  pos,
  act,
}: {
  pos: number
  act: 'enter' | 'combine' | 'sell'
}) {
  switch (act) {
    case 'enter':
      game.post('$hand-enter', {
        place: pos,
        player: player.pos,
      })
      break
    case 'combine':
      game.post('$hand-combine', {
        place: pos,
        player: player.pos,
      })
      break
    case 'sell':
      game.post('$hand-sell', {
        place: pos,
        player: player.pos,
      })
      break
  }
}

function requestStore({
  pos,
  act,
}: {
  pos: number
  act: 'enter' | 'combine' | 'cache'
}) {
  switch (act) {
    case 'enter':
      game.post('$buy-enter', {
        place: pos,
        player: player.pos,
      })
      break
    case 'combine':
      game.post('$buy-combine', {
        place: pos,
        player: player.pos,
      })
      break
    case 'cache':
      game.post('$buy-cache', {
        place: pos,
        player: player.pos,
      })
      break
  }
}

function requestPresent({
  pos,
  act,
}: {
  pos: number
  act: 'upgrade' | 'sell'
}) {
  switch (act) {
    case 'upgrade':
      game.post('$present-upgrade', {
        place: pos,
        player: player.pos,
      })
      break
    case 'sell':
      game.post('$present-sell', {
        place: pos,
        player: player.pos,
      })
      break
  }
}

function requestUpgrade() {
  game.post('$upgrade', {
    player: player.pos,
  })
}

function requestRefresh() {
  game.post('$refresh', {
    player: player.pos,
  })
}

function requestUnlock() {
  game.post('$unlock', {
    player: player.pos,
  })
}

function requestLock() {
  game.post('$lock', {
    player: player.pos,
  })
}

function requestNext() {
  game.post('$done', {
    player: player.pos,
  })
}

function insertChoose({ pos }: { pos: number }) {
  game.post('$insert-choice', {
    choice: pos,
    player: player.pos,
  })
}
function discoverChoose({ pos }: { pos: number }) {
  game.post('$discover-choice', {
    choice: pos,
    player: player.pos,
  })
}

// game.post('$obtain-card', {
//   card: '沃菲尔德',
//   player: player.pos,
// })
// game.post('$obtain-card', {
//   card: '游骑兵',
//   player: player.pos,
// })
</script>

<template>
  <div class="d-flex flex-column pa-1">
    <div class="d-flex">
      <div class="d-flex flex-column text-h6" :key="`Info-${timeTick}`">
        <span
          >回合 {{ game.data.round }} 等级 {{ player.data.level }} 升级
          {{ player.data.upgrade_cost }} 总价值 {{ player.value() }}</span
        >
        <span
          >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
          {{ player.data.gas }} / 6</span
        >
        <div class="d-flex">
          <v-btn
            class="mr-1"
            :disabled="model || !player.can_tavern_upgrade()"
            @click="requestUpgrade"
            >升级</v-btn
          >
          <v-btn
            class="mr-1"
            :disabled="model || !player.can_refresh()"
            @click="requestRefresh"
            >刷新</v-btn
          >
          <v-btn
            v-if="player.data.locked"
            class="mr-1"
            :disabled="model"
            @click="requestUnlock"
            >解锁</v-btn
          >
          <v-btn v-else class="mr-1" :disabled="model" @click="requestLock"
            >锁定</v-btn
          >
          <v-btn :disabled="model" @click="requestNext">下一回合</v-btn>
        </div>
        <div id="HandRegion">
          <hand-item
            class="mt-2 mr-2"
            v-for="(h, i) in player.hand"
            :key="`Hand-Item-${i}-${timeTick}`"
            :player="player"
            :card="h"
            :model="model"
            :pos="i"
            @request="requestHand"
          ></hand-item>
        </div>
      </div>
      <div class="d-flex flex-column">
        <div class="d-flex">
          <store-item
            v-for="(s, i) in player.store"
            :key="`Store-Item-${i}-${timeTick}`"
            class="mr-2"
            :player="player"
            :card="s"
            :model="model"
            :pos="i"
            @request="requestStore"
          ></store-item>
        </div>
        <div class="d-flex mt-4">
          <discover-item
            v-for="(it, i) in discoverItems"
            :key="`Discover-Item-${i}-${timeTick}`"
            class="mr-2"
            :player="player"
            :item="it"
            :model="model"
            :pos="i"
            @choose="discoverChoose"
          ></discover-item>
          <v-btn
            v-if="discoverCancel"
            variant="text"
            @click="discoverChoose({ pos: -1 })"
            color="red"
            >放弃</v-btn
          >
        </div>
      </div>
    </div>
    <div class="d-flex mt-2">
      <div
        v-for="(p, i) in player.present"
        :key="`Present-Item-${i}-${timeTick}`"
      >
        <present-item
          class="mr-1"
          :player="player"
          :card="p"
          :model="model"
          :pos="i"
          :insert="insert"
          @request="requestPresent"
          @choose="insertChoose"
        ></present-item>
      </div>
    </div>
  </div>
</template>

<style scoped>
#HandRegion {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(2, 1fr);
}
</style>
