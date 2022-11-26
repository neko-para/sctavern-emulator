<script setup lang="ts">
import { ref, computed } from 'vue'
import { Client, LocalGame, type GameReplay } from 'emulator'
import { getRole } from 'data'
import StoreItem from './StoreItem.vue'
import HandItem from './HandItem.vue'
import PresentItem from './PresentItem.vue'
import DiscoverItem from './DiscoverItem.vue'
import ConfigDialog from './ConfigDialog.vue'
import {
  AllCard,
  getCard,
  type Card,
  type CardKey,
  type UpgradeKey,
  type RoleKey,
} from 'data'
import { applyConfigChange, compress, decompress } from './utils'
import type { SlaveGame } from 'emulator/client'

const props = defineProps<{
  pack: string[]
  seed: string
  role: RoleKey
  replay: string | null
}>()

const model = ref(false)
const discover = ref(false)
const insert = ref(false)
const selected = ref('none')
const discoverItems = ref<(Card | UpgradeKey)[]>([])
const discoverCancel = ref(false)

const game = new LocalGame({
  pack: props.pack,
  seed: props.seed,
  role: [props.role],
})

class LocalClient extends Client {
  timeout: number | null

  constructor(game: SlaveGame, pos: number) {
    super(game, pos)
    this.timeout = null
  }

  async refresh() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.timeout = setTimeout(() => {
      timeTick.value += 1
      this.timeout = null
    }, 1)
  }

  async selected(choice: string) {
    selected.value = choice
  }

  async begin_insert() {
    insert.value = true
    model.value = true
    await super.replay_insert()
  }

  async end_insert() {
    insert.value = false
    model.value = false
  }

  async begin_discover(item: (Card | UpgradeKey)[], cancel: boolean) {
    discover.value = true
    discoverItems.value = item
    discoverCancel.value = cancel
    model.value = true
    await super.replay_discover()
  }

  async end_discover() {
    discover.value = false
    discoverItems.value = []
    discoverCancel.value = false
    model.value = false
  }
}

const client = new LocalClient(game.slave, 0)

const player = client.player

const timeTick = ref(0)

async function main() {
  game.master.poll()
  game.slave.poll()
  await game.slave.game.start()
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
    .filter(c => c.pinyin.indexOf(obtainCardKey.value) !== -1)
    .slice(0, 10)
})

function handleKey(ev: KeyboardEvent) {
  if (model.value || expDlg.value || impDlg.value || obtainCardDlg.value) {
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
      if (player.present[pos]) {
        client.selectChoose(`P${pos}`)
      } else {
        client.selectChoose('none')
      }
      break
    }
    case 'w':
      client.requestUpgrade()
      return
    case 'c':
      if (player.data.locked) {
        client.requestUnlock()
      } else {
        client.requestLock()
      }
      return
    case 'z':
      client.requestNext()
      return
    case 'r':
      client.requestRefresh()
      return
  }
  const m = /^[HSP](\d)$/.exec(selected.value)
  if (!m) {
    return
  }
  const pos = Number(m[1])
  switch (selected.value[0]) {
    case 'H':
      if (!player.hand[pos]) {
        return
      }
      switch (ev.key) {
        case 'e':
          client.requestHand({
            pos,
            act: player.can_hand_combine(player.hand[pos] as CardKey)
              ? 'combine'
              : 'enter',
          })
          return
        case 's':
          client.requestHand({
            pos,
            act: 'sell',
          })
          return
      }
      break
    case 'S':
      if (!player.store[pos]) {
        return
      }
      switch (ev.key) {
        case 'e':
          client.requestStore({
            pos,
            act: player.can_buy_combine(player.store[pos] as CardKey)
              ? 'combine'
              : 'enter',
          })
          return
        case 'v':
          client.requestStore({
            pos,
            act: 'cache',
          })
          return
      }
      break
    case 'P':
      if (!player.present[pos]) {
        return
      }
      switch (ev.key) {
        case 'g':
          client.requestPresent({
            pos,
            act: 'upgrade',
          })
          return
        case 's':
          client.requestPresent({
            pos,
            act: 'sell',
          })
          return
      }
      break
  }
}

const expDlg = ref(false)
const expData = ref('')

function doExport() {
  expData.value = compress({
    pack: props.pack,
    seed: props.seed,
    role: props.role,
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
  <div class="d-flex flex-column pa-1">
    <div class="d-flex">
      <div class="d-flex flex-column text-h6" :key="`Info-${timeTick}`">
        <span
          >回合 {{ game.slave.game.data.round }} 等级
          {{ player.data.level }} 升级 {{ player.data.upgrade_cost }} 总价值
          {{ player.value() }}</span
        >
        <span
          >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
          {{ player.data.gas }} / 6</span
        >
        <div class="d-flex">
          <v-btn
            class="mr-1"
            :disabled="model || !player.can_tavern_upgrade()"
            @click="client.requestUpgrade()"
            >升级</v-btn
          >
          <v-btn
            class="mr-1"
            :disabled="model || !player.can_refresh()"
            @click="client.requestRefresh()"
            >刷新</v-btn
          >
          <v-btn
            v-if="player.data.locked"
            class="mr-1"
            :disabled="model"
            @click="client.requestUnlock()"
            >解锁</v-btn
          >
          <v-btn
            v-else
            class="mr-1"
            :disabled="model"
            @click="client.requestLock()"
            >锁定</v-btn
          >
          <v-btn class="mr-1" :disabled="model" @click="client.requestNext()"
            >下一回合</v-btn
          >
          <v-btn
            v-if="!model"
            :disabled="!player.can_use_ability()"
            @click="client.requestAbility()"
            >{{ getRole(role).ability }}</v-btn
          >
        </div>
        <div class="d-flex mt-1">
          <config-dialog></config-dialog>
          <v-dialog v-model="obtainCardDlg" class="w-25">
            <template v-slot:activator="{ props }">
              <v-btn class="ml-1" v-bind="props" :disabled="model"
                >获取卡牌</v-btn
              >
            </template>
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

          <v-btn
            class="ml-1"
            :disabled="model"
            @click="client.requestResource()"
            >获得资源</v-btn
          >
        </div>
        <div class="d-flex mt-1">
          <v-dialog v-model="expDlg" class="w-50">
            <v-card>
              <v-card-title>导出</v-card-title>
              <v-card-text>
                <v-textarea
                  readonly
                  hide-details
                  v-model="expData"
                ></v-textarea>
              </v-card-text>
            </v-card>
          </v-dialog>
          <v-btn :disabled="model" @click="doExport()">导出</v-btn>
          <v-dialog v-model="impDlg" class="w-50">
            <template v-slot:activator="{ props }">
              <v-btn class="ml-1" v-bind="props" :disabled="model">导入</v-btn>
            </template>
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
        </div>
        <div id="HandRegion">
          <hand-item
            class="mt-2 mr-2"
            v-for="(h, i) in player.hand"
            :key="`Hand-Item-${i}-${timeTick}`"
            :card="h"
            :model="model"
            :pos="i"
            :selected="selected === `H${i}`"
            :client="client"
          ></hand-item>
        </div>
      </div>
      <div class="d-flex flex-column">
        <div class="d-flex">
          <store-item
            v-for="(s, i) in player.store"
            :key="`Store-Item-${i}-${timeTick}`"
            class="mr-2"
            :card="s"
            :model="model"
            :pos="i"
            :selected="selected === `S${i}`"
            :client="client"
          ></store-item>
        </div>
        <div class="d-flex mt-4" v-if="discover">
          <discover-item
            v-for="(it, i) in discoverItems"
            :key="`Discover-Item-${i}-${timeTick}`"
            class="mr-2"
            :item="it"
            :model="model"
            :pos="i"
            :client="client"
          ></discover-item>
          <v-btn
            v-if="discoverCancel"
            variant="text"
            @click="client.discoverChoose({ pos: -1 })"
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
          class="mr-2"
          :card="p"
          :model="model"
          :pos="i"
          :insert="insert"
          :selected="selected === `P${i}`"
          :client="client"
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
.enterSelect {
  font-weight: 600;
}
</style>
