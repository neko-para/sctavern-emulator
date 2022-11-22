<script setup lang="ts">
import { getCard, type CardKey } from 'data'
import type { Player } from 'emulator'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  player: Player
  card: CardKey | null
  model: boolean
  pos: number
}>()

const cardInfo = props.card ? getCard(props.card) : null
</script>

<template>
  <v-card id="handItemRoot" class="d-flex flex-column space-between">
    <template v-if="card && cardInfo">
      <div class="d-flex">
        <race-icon class="mt-1" :race="cardInfo.race"></race-icon>
        <span class="text-h5 mt-2">{{ cardInfo.name }}</span>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ cardInfo.level }}</span>
      </div>
      <div class="d-flex mt-auto">
        <v-btn
          :disabled="model || !player.can_hand_combine(card)"
          variant="text"
          v-if="player.find_name(card).length >= 2"
          @click="$emit('request', { pos, act: 'combine' })"
          >三连</v-btn
        >
        <v-btn
          :disabled="model || !player.can_hand_enter()"
          variant="text"
          v-else
          @click="$emit('request', { pos, act: 'enter' })"
          >进场</v-btn
        >
        <v-btn
          :disabled="model"
          variant="text"
          @click="$emit('request', { pos, act: 'sell' })"
          >出售</v-btn
        >
      </div>
    </template>
  </v-card>
</template>

<style scoped>
#handItemRoot {
  width: 200px;
  height: 100px;
}
</style>
