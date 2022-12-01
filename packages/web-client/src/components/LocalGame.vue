<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Client,
  LocalGame,
  type GameReplay,
  SlaveGame,
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
  type UpgradeKey,
  type RoleKey,
} from '@sctavern-emulator/data'
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
      if (player.data.present[pos]) {
        client.selectChoose(`P${pos}`)
      } else {
        client.selectChoose('none')
      }
      break
    }
    default: {
      for (const act of player.data.globalActs) {
        if (ev.key === act.accelerator && act.enable) {
          client.post(act.message, {
            player: player.pos,
          })
        }
      }
      const m = /^([HSP])(\d)$/.exec(selected.value)
      if (!m) {
        return
      }
      const stype = m[1] as 'H' | 'S' | 'P'
      const pos = Number(m[2])
      const acts = (() => {
        switch (stype) {
          case 'H':
            return player.data.handActs[pos]
          case 'S':
            return player.data.storeActs[pos]
          case 'P':
            return player.data.presentActs[pos]
        }
      })()
      for (const act of acts) {
        if (ev.key === act.accelerator && act.enable) {
          client.post(act.message, {
            player: player.pos,
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
  <div class="d-flex flex-column pa-1">
    <div class="d-flex">
      <div class="d-flex flex-column text-h6" :key="`Info`">
        <span
          >回合 {{ game.slave.game.data.round }} 等级
          {{ player.data.level }} 升级 {{ player.data.upgrade_cost }} 总价值
          {{ player.data.value }}</span
        >
        <span
          >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
          {{ player.data.gas }} / 6</span
        >
        <div class="d-flex">
          <v-btn
            v-for="(act, i) in player.data.globalActs"
            :key="`GlobalAct-${i}`"
            class="mr-1"
            :disabled="model || !act.enable"
            @click="client.post(act.message, { player: player.pos })"
            >{{ act.name }}</v-btn
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