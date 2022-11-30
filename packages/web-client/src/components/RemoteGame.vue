<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Client,
  SlaveGame,
  type Adapter,
  type InputBus,
  type LogItem,
} from '@sctavern-emulator/emulator'
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
} from '@sctavern-emulator/data'

const props = defineProps<{
  target: string
  pos: number
}>()

const model = ref(false)
const discover = ref(false)
const insert = ref(false)
const selected = ref('none')
const discoverItems = ref<(Card | UpgradeKey)[]>([])
const discoverCancel = ref(false)

class ClientAdapter implements Adapter {
  onPosted: (item: LogItem) => void
  sock: WebSocket

  async post<T extends keyof InputBus>(msg: T, param: InputBus[T]) {
    this.sock.send(
      JSON.stringify({
        msg,
        param,
      })
    )
  }

  constructor(url: string = 'ws://localhost:8080') {
    this.onPosted = () => {
      //
    }

    this.sock = new WebSocket(url)
    this.sock.addEventListener('open', () => {
      game.game.start()
    })
    this.sock.addEventListener('message', ({ data }) => {
      this.onPosted(JSON.parse(data) as LogItem)
    })
  }
}

const game = new SlaveGame(
  {
    pack: ['核心'],
    seed: '1',
    role: ['SCV', '副官'],
  },
  new ClientAdapter()
)

class LocalClient extends Client {
  constructor(game: SlaveGame, pos: number) {
    super(game, pos)
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

const client = new LocalClient(game, props.pos)

const player = client.player

async function main() {
  game.poll()
}

const obtainCardDlg = ref(false)
const obtainCardKey = ref('')

const obtainCardChoice = computed(() => {
  return AllCard.map(getCard)
    .filter(c => c.pinyin.indexOf(obtainCardKey.value) !== -1)
    .slice(0, 10)
})

function handleKey(ev: KeyboardEvent) {
  if (model.value || obtainCardDlg.value) {
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
      if (!player.data.hand[pos]) {
        return
      }
      switch (ev.key) {
        case 'e':
          client.requestHand({
            pos,
            act: player.can_hand_combine(player.data.hand[pos] as CardKey)
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
      if (!player.data.store[pos]) {
        return
      }
      switch (ev.key) {
        case 'e':
          client.requestStore({
            pos,
            act: player.can_buy_combine(player.data.store[pos] as CardKey)
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

document.onkeydown = handleKey

main()
</script>

<template>
  <div class="d-flex flex-column pa-1">
    <div class="d-flex">
      <div class="d-flex flex-column text-h6" :key="`Info`">
        <span
          >回合 {{ player.game.data.round }} 等级 {{ player.data.level }} 升级
          {{ player.data.upgrade_cost }} 总价值 {{ player.data.value }}</span
        >
        <span
          >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
          {{ player.data.gas }} / 6</span
        >
        <span>
          {{ game.game.player[0].data.value }},
          {{ game.game.player[1].data.value }}
        </span>
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
          <v-btn
            class="ml-1"
            :disabled="model || !player.data.ability.enable"
            :color="player.data.ability.enpower ? 'white' : ''"
            @click="client.requestAbility()"
            >{{ player.data.ability.name
            }}{{
              player.data.ability.prog_cur !== -1
                ? ` ${player.data.ability.prog_cur} / ${player.data.ability.prog_max}`
                : ''
            }}</v-btn
          >
        </div>
        <div id="HandRegion">
          <hand-item
            class="mt-2 mr-2"
            v-for="(h, i) in player.data.hand"
            :key="`Hand-Item-${i}`"
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
            v-for="(s, i) in player.data.store"
            :key="`Store-Item-${i}`"
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
            :key="`Discover-Item-${i}`"
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
      <div v-for="(p, i) in player.data.present" :key="`Present-Item-${i}`">
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
