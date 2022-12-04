<script setup lang="ts">
import { ref, computed } from 'vue'
import StoreItem from './StoreItemMobile.vue'
import HandItem from './HandItemMobile.vue'
import PresentItem from './PresentItemMobile.vue'
import PresentItemInfo from './PresentItemInfoMobile.vue'
import DiscoverItem from './DiscoverItemMobile.vue'
import type { ClientStatus } from './types'
import type { WebClient } from './WebClient'
import type { CardInstanceAttrib } from '@sctavern-emulator/emulator'

const props = defineProps<{
  status: ClientStatus
  client: WebClient
}>()

const player = computed(() => {
  return props.client.player
})

const extraDlg = ref(false)
</script>

<template>
  <div class="d-flex flex-column pa-1">
    <v-dialog :value="status.discover" persistent>
      <v-card>
        <v-card-text
          class="d-flex justify-space-around"
          v-for="(it, i) in status.discoverItems"
          :key="`Discover-Item-${i}`"
        >
          <discover-item
            class="mr-2"
            :item="it"
            :model="status.model"
            :pos="i"
            :client="client"
          ></discover-item>
        </v-card-text>
        <v-card-actions v-if="status.discoverCancel">
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
            >回合 {{ player.game.data.round }} 等级 {{ player.data.level }} 升级
            {{ player.data.upgrade_cost }} 总价值 {{ player.data.value }}</span
          >
          <span
            >晶矿 {{ player.data.mineral }} / {{ player.data.mineral_max }} 瓦斯
            {{ player.data.gas }} / 6</span
          >
        </div>
        <v-btn
          :disabled="status.model || !player.data.ability.enable"
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
          v-for="(act, i) in player.data.globalActs"
          :key="`GlobalAct-${i}`"
          class="mr-1"
          :disabled="status.model || !act.enable"
          @click="client.post(act.message, { player: player.pos })"
          >{{ act.name }}</v-btn
        >

        <v-dialog v-model="extraDlg">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props">其它</v-btn>
          </template>
          <v-card>
            <v-card-text>
              <slot></slot>
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
        :model="status.model"
        :pos="i"
        :selected="status.selected === `S${i}`"
        :client="client"
      ></store-item>
    </div>
    <div class="grid23 mt-1">
      <hand-item
        class="mb-2"
        v-for="(h, i) in player.data.hand"
        :key="`Hand-Item-${i}`"
        :card="h"
        :model="status.model"
        :pos="i"
        :selected="status.selected === `H${i}`"
        :client="client"
      ></hand-item>
    </div>
    <div class="d-flex mt-1">
      <div class="d-flex flex-column">
        <div v-for="(p, i) in player.data.present" :key="`Present-Item-${i}`">
          <present-item
            class="mb-2"
            :card="p"
            :model="status.model"
            :pos="i"
            :insert="status.insert"
            :selected="status.selected === `P${i}`"
            :client="client"
          ></present-item>
        </div>
      </div>
      <template
        v-if="
          status.selected[0] === 'P' &&
          player.data.present[Number(status.selected.substring(1))]
        "
      >
        <present-item-info
          :card="player.data.present[Number(status.selected.substring(1))] as CardInstanceAttrib"
          :model="status.model"
          :pos="Number(status.selected.substring(1))"
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
