<script setup lang="ts">
import { ref } from 'vue'
import type { Card, UpgradeKey } from 'data'
import { tr } from 'data'
import type { Client } from 'emulator'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  item: Card | UpgradeKey
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
    <template v-if="typeof item !== 'string'">
      <div class="d-flex text-h6 mx-1 w-100">
        <span>{{ tr[item.race] }}</span>
        <span class="ml-1">{{ item.name }}</span>
        <span class="ml-auto">{{ item.level }}</span>
      </div>
    </template>
    <template v-else>
      <div class="d-flex">
        <span class="text-h5 ml-2 mt-2">{{ item }}</span>
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
