<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Client,
  LocalGame,
  type CardInstanceAttrib,
  type GameReplay,
  SlaveGame,
} from 'emulator'
import StoreItem from './StoreItemMobile.vue'
import HandItem from './HandItemMobile.vue'
import PresentItem from './PresentItemMobile.vue'
import PresentItemInfo from './PresentItemInfoMobile.vue'
import DiscoverItem from './DiscoverItemMobile.vue'
import ConfigDialog from './ConfigDialogMobile.vue'
import {
  AllCard,
  getCard,
  type Card,
  type UpgradeKey,
  type RoleKey,
} from 'data'
import { applyConfigChange, compress, decompress } from './utils'

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

const client = new LocalClient(game.slave, 0)

const player = client.player

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

const extraDlg = ref(false)

const obtainCardDlg = ref(false)
const obtainCardKey = ref('')

const obtainCardChoice = computed(() => {
  return AllCard.map(getCard)
    .filter(c => c.pinyin.indexOf(obtainCardKey.value) !== -1)
    .slice(0, 10)
})

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

main()
</script>

<template>
  <div class="d-flex flex-column pa-1">
    <v-dialog v-model="discover" persistent>
      <v-card>
        <v-card-text
          class="d-flex justify-space-around"
          v-for="(it, i) in discoverItems"
          :key="`Discover-Item-${i}`"
        >
          <discover-item
            class="mr-2"
            :item="it"
            :model="model"
            :pos="i"
            :client="client"
          ></discover-item>
        </v-card-text>
        <v-card-actions v-if="discoverCancel">
          <v-btn @click="client.discoverChoose({ pos: -1 })" color="red"
            >放弃</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <div class="d-flex flex-column" :key="`Info`">
      <div class="d-flex justify-space-between">
        <div class="d-flex flex-column">
          <span
            >回合 {{ game.slave.game.data.round }} 等级
            {{ player.data.level }} 升级 {{ player.data.upgrade_cost }} 总价值
            {{ player.data.value }}</span
          >
          <span
            >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
            {{ player.data.gas }} / 6</span
          >
        </div>
        <v-btn
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

        <v-dialog v-model="extraDlg">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props">其它</v-btn>
          </template>
          <v-card>
            <v-card-text>
              <div class="d-flex mt-1">
                <config-dialog></config-dialog>
                <v-dialog v-model="obtainCardDlg">
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
                <v-dialog v-model="expDlg">
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
                <v-dialog v-model="impDlg">
                  <template v-slot:activator="{ props }">
                    <v-btn class="ml-1" v-bind="props" :disabled="model"
                      >导入</v-btn
                    >
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
            </v-card-text>
          </v-card>
        </v-dialog>
      </div>
    </div>

    <div class="grid23 mt-2">
      <store-item
        class="mb-2"
        v-for="(s, i) in player.data.store"
        :key="`Store-Item-${i}`"
        :card="s"
        :model="model"
        :pos="i"
        :selected="selected === `S${i}`"
        :client="client"
      ></store-item>
    </div>
    <div class="grid23 mt-1">
      <hand-item
        class="mb-2"
        v-for="(h, i) in player.data.hand"
        :key="`Hand-Item-${i}`"
        :card="h"
        :model="model"
        :pos="i"
        :selected="selected === `H${i}`"
        :client="client"
      ></hand-item>
    </div>
    <div class="d-flex mt-1">
      <div class="d-flex flex-column">
        <div v-for="(p, i) in player.data.present" :key="`Present-Item-${i}`">
          <present-item
            class="mb-2"
            :card="p"
            :model="model"
            :pos="i"
            :insert="insert"
            :selected="selected === `P${i}`"
            :client="client"
          ></present-item>
        </div>
      </div>
      <template
        v-if="
          selected[0] === 'P' &&
          player.data.present[Number(selected.substring(1))]
        "
      >
        <present-item-info
          :card="player.data.present[Number(selected.substring(1))] as CardInstanceAttrib"
          :model="model"
          :pos="Number(selected.substring(1))"
          :client="client"
          :key="`Present-Item-Open`"
        ></present-item-info>
      </template>
    </div>
  </div>
</template>

<style scoped>
.grid23 {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(2, 1fr);
}
.enterSelect {
  font-weight: 600;
}
</style>
