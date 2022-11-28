<script setup lang="ts">
import { ref } from 'vue'
import { getCard, type CardKey } from '@sctavern-emulator/data'
import type { Client } from '@sctavern-emulator/emulator'
import TemplateRefer from './TemplateRefer.vue'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  card: CardKey | null
  model: boolean
  pos: number
  selected: boolean
  client: Client
}>()

const cardInfo = props.card ? getCard(props.card) : null
const elv = ref(5)
</script>

<template>
  <v-card
    id="handItemRoot"
    class="d-flex flex-column justify-space-between"
    :elevation="elv"
    :class="{
      selected: selected,
    }"
    @mouseover="elv = 10"
    @mouseout="elv = 5"
    @click="client.selectChoose(card ? `H${pos}` : 'none')"
  >
    <template v-if="card && cardInfo">
      <div class="d-flex">
        <race-icon class="mt-1" :race="cardInfo.race"></race-icon>
        <template-refer :card="card"></template-refer>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ cardInfo.level }}</span>
      </div>
      <div class="d-flex">
        <v-btn
          :disabled="model || !client.player.can_hand_combine(card)"
          variant="flat"
          v-if="client.player.can_hand_combine(card)"
          @click="
            client.requestHand({
              act: 'combine',
              pos,
            })
          "
          color="yellow"
          >三连</v-btn
        >
        <v-btn
          :disabled="model || !client.player.can_hand_enter()"
          variant="text"
          v-else
          @click="
            client.requestHand({
              act: 'enter',
              pos,
            })
          "
          >进场</v-btn
        >
        <v-btn
          :disabled="model"
          variant="text"
          @click="
            client.requestHand({
              act: 'sell',
              pos,
            })
          "
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
  transition: border 0.1s;
}

.selected {
  border: 2px solid black;
}
</style>
