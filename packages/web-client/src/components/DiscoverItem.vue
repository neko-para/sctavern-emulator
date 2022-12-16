<script setup lang="ts">
import { ref } from 'vue'
import type { Card, Upgrade } from '@sctavern-emulator/data'
import type { Client } from '@sctavern-emulator/emulator'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  item: Card | Upgrade | String
  model: boolean
  pos: number
  client: Client
}>()

const elv = ref(5)
</script>

<template>
  <v-card
    id="discoverItemRoot"
    class="d-flex flex-column space-between"
    :elevation="elv"
    @mouseover="elv = 10"
    @mouseout="elv = 5"
    @click="
      client.discoverChoose({
        pos,
      })
    "
  >
    <template v-if="!(item instanceof String) && item.type === 'card'">
      <div class="d-flex">
        <race-icon class="mt-1" :race="item.race"></race-icon>
        <span class="text-h5 mt-2">{{ item.name }}</span>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ item.level }}</span>
      </div>
    </template>
    <template v-else>
      <div class="d-flex">
        <span class="text-h5 ml-2 mt-2">{{
          item instanceof String ? item : item.name
        }}</span>
      </div>
    </template>
  </v-card>
</template>

<style scoped>
#discoverItemRoot {
  width: 200px;
  height: 100px;
}
</style>
