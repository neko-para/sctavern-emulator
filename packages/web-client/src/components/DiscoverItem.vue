<script setup lang="ts">
import { AllCard, getCard, type CardKey, type UpgradeKey } from 'data'
import type { Player } from 'emulator'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  player: Player
  item: CardKey | UpgradeKey
  model: boolean
  pos: number
}>()

const cardInfo = AllCard.includes(props.item as CardKey)
  ? getCard(props.item as CardKey)
  : null
</script>

<template>
  <v-card id="discoverItemRoot" class="d-flex flex-column space-between">
    <template v-if="cardInfo">
      <div class="d-flex">
        <race-icon class="mt-1" :race="cardInfo.race"></race-icon>
        <span class="text-h5 mt-2">{{ cardInfo.name }}</span>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ cardInfo.level }}</span>
      </div>
      <div class="d-flex mt-auto">
        <v-btn variant="text" @click="$emit('choose', { pos })">这个</v-btn>
      </div>
    </template>
    <template v-else>
      <div class="d-flex">
        <span class="text-h5 ml-2 mt-2">{{ item }}</span>
      </div>
      <div class="d-flex mt-auto">
        <v-btn variant="text" @click="$emit('choose', { pos })">这个</v-btn>
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
