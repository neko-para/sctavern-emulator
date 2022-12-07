<script setup lang="ts">
import { computed } from 'vue'
import StoreItem from './StoreItem.vue'
import HandItem from './HandItem.vue'
import PresentItem from './PresentItem.vue'
import DiscoverItem from './DiscoverItem.vue'
import type { ClientStatus } from './types'
import type { WebClient } from './WebClient'

const props = defineProps<{
  status: ClientStatus
  client: WebClient
}>()

const player = computed(() => {
  return props.client.player
})

const heroExtraList = computed(() => {
  return props.client.player.data.ability.extra
})
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
        <div class="d-flex mb-1 justify-space-between pr-2">
          <v-btn
            v-for="(act, i) in player.data.globalActs"
            :key="`GlobalAct-${i}`"
            :disabled="status.model || !act.enable"
            @click="client.post(act.message, { player: player.pos })"
            >{{ act.name }}</v-btn
          >

          <v-tooltip location="bottom">
            <template v-slot:activator="{ props: p }">
              <v-btn
                v-bind="p"
                :color="
                  player.data.ability.enpower
                    ? 'red'
                    : player.data.ability.enable
                    ? ''
                    : 'grey'
                "
                @click="
                  !status.model &&
                    player.data.ability.enable &&
                    client.requestAbility()
                "
                >{{ player.data.ability.data.ability
                }}{{
                  player.data.ability.prog_cur !== -1
                    ? ` ${player.data.ability.prog_cur} / ${player.data.ability.prog_max}`
                    : ''
                }}</v-btn
              >
            </template>
            <pre>{{ player.data.ability.data.desc }}</pre>
            <!-- <pre>{{ player.data.ability.extra }}</pre> -->
            <div class="heroExtra" v-if="heroExtraList">
              <ul
                :style="{
                  height: `${(heroExtraList.length / 2) * 22.4}px`,
                }"
              >
                <li v-for="(s, i) in heroExtraList" :key="i">
                  {{ s }}
                </li>
              </ul>
            </div>
          </v-tooltip>
        </div>
        <slot></slot>
        <div id="HandRegion">
          <hand-item
            class="mt-2 mr-2"
            v-for="(h, i) in player.data.hand"
            :key="`Hand-Item-${i}`"
            :card="h"
            :model="status.model"
            :pos="i"
            :selected="status.selected === `H${i}`"
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
            :model="status.model"
            :pos="i"
            :selected="status.selected === `S${i}`"
            :client="client"
          ></store-item>
        </div>
        <div class="d-flex mt-4" v-if="status.discover">
          <discover-item
            v-for="(it, i) in status.discoverItems"
            :key="`Discover-Item-${i}`"
            class="mr-2"
            :item="it"
            :model="status.model"
            :pos="i"
            :client="client"
          ></discover-item>
          <v-btn
            v-if="status.discoverCancel"
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
          :model="status.model"
          :pos="i"
          :insert="status.insert"
          :deploy="status.deploy"
          :selected="status.selected === `P${i}`"
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
.heroExtra {
}
.heroExtra ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: space-around;
  width: 400px;
}
.heroExtra ul > li {
  flex: 1;
  height: 22.4px;
}
</style>
