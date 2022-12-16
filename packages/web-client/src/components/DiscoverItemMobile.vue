<script setup lang="ts">
import { ref } from 'vue'
import type { Card, Upgrade } from '@sctavern-emulator/data'
import { tr } from '@sctavern-emulator/data'
import type { Client } from '@sctavern-emulator/emulator'

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
    class="d-flex align-center"
    :elevation="elv"
    @mouseover="elv = 10"
    @mouseout="elv = 5"
    @click="
      client.discoverChoose({
        pos,
      })
    "
  >
    <template
      v-if="
        !(item instanceof String || typeof item === 'string') &&
        item.type === 'card'
      "
    >
      <div class="d-flex text-h6 mx-1 w-100">
        <span>{{ tr[item.race] }}</span>
        <span class="ml-1">{{ item.name }}</span>
        <span class="ml-auto">{{ item.level }}</span>
      </div>
    </template>
    <template v-else>
      <div class="d-flex">
        <span class="text-h5 ml-2 mt-2">{{
          item instanceof String || typeof item === 'string' ? item : item.name
        }}</span>
      </div>
    </template>
  </v-card>
</template>

<style scoped>
#discoverItemRoot {
  width: 200px;
  height: 50px;
}
</style>
