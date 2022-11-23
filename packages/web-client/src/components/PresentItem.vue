<script setup lang="ts">
import { computed } from 'vue'
import type { CardInstance, Player } from 'emulator'
import RaceIcon from './RaceIcon.vue'
import type { UnitKey } from 'data'

const props = defineProps<{
  player: Player
  card: CardInstance | null
  model: boolean
  pos: number
  insert: boolean
}>()

const allUnit = computed(() => {
  const us: {
    [u in UnitKey]?: number
  } = {}
  props.card?.data.units.forEach(u => {
    us[u] = (us[u] || 0) + 1
  })
  return Object.keys(us).map(u => `${u}: ${us[u as UnitKey]}`)
})

const Color = {
  normal: 'white',
  gold: 'yellow',
  darkgold: 'amber',
}
</script>

<template>
  <v-card
    id="presentItemRoot"
    class="d-flex flex-column space-between"
    :color="card ? Color[card.data.color] : 'white'"
  >
    <template v-if="card">
      <div class="d-flex">
        <race-icon class="mt-1" :race="card.data.race"></race-icon>
        <span class="text-h5 mt-2">{{ card.data.name }}</span>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ card.data.level }}</span>
      </div>
      <div class="d-flex ma-1">
        <span class="text-h5">{{ card.value() }}</span>
        <span class="text-h5 ml-auto"
          >{{ card.data.units.length }} /
          {{ player.config.MaxUnitPerCard }}</span
        >
      </div>
      <div class="d-flex">
        <div class="d-flex flex-column">
          <span
            class="mx-1"
            v-for="(a, i) in card.attribs()"
            :key="`Attrib-${i}`"
          >
            {{ a }}
          </span>
        </div>
        <div class="d-flex flex-column ml-auto mr-1">
          <span v-for="(u, i) in card.data.upgrades" :key="`Upgrade-${i}`">{{
            u
          }}</span>
        </div>
      </div>
      <div class="d-flex mt-auto ml-1">
        <div class="d-flex flex-column align-self-end">
          <template v-if="allUnit.length <= 6">
            <span v-for="(s, i) in allUnit" :key="`Unit-${i}`">{{ s }}</span>
          </template>
          <template v-else>
            <span v-for="(s, i) in allUnit.slice(0, 5)" :key="`Unit-${i}`">{{
              s
            }}</span>
            <v-tooltip location="top">
              <template v-slot:activator="{ props: p }">
                <span v-bind="p">...</span>
              </template>
              <pre>{{ allUnit.join('\n') }}</pre>
            </v-tooltip>
          </template>
        </div>
      </div>
      <div class="d-flex">
        <v-btn
          :disabled="model || !player.can_pres_upgrade(card)"
          variant="text"
          @click="$emit('request', { pos, act: 'upgrade' })"
          >升级</v-btn
        >
        <v-btn
          :disabled="model"
          variant="text"
          @click="$emit('request', { pos, act: 'sell' })"
          >出售</v-btn
        >
        <v-btn
          class="ml-auto"
          v-if="insert"
          variant="text"
          @click="$emit('choose', { pos })"
          >这里</v-btn
        >
      </div>
    </template>
    <template v-else>
      <v-btn
        class="mt-auto ml-auto"
        v-if="insert"
        variant="text"
        @click="$emit('choose', { pos })"
        >这里</v-btn
      >
    </template>
  </v-card>
</template>

<style scoped>
#presentItemRoot {
  width: 250px;
  height: 350px;
}
</style>
