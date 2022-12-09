<script setup lang="ts">
import { ref, computed } from 'vue'
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

const cardInfo = computed(() => {
  return props.card ? getCard(props.card) : null
})
const elv = ref(5)
</script>

<template>
  <v-card
    id="storeItemRoot"
    class="d-flex flex-column justify-space-between"
    :color="client.player.data.locked && card ? 'cyan' : 'white'"
    :elevation="elv"
    :class="{
      selected: selected,
    }"
    @mouseover="elv = 10"
    @mouseout="elv = 5"
    @click="!model && client.selectChoose(card ? `S${pos}` : 'none')"
  >
    <template v-if="card && cardInfo">
      <div class="d-flex">
        <race-icon class="mt-1" :race="cardInfo.race"></race-icon>
        <template-refer :card="card"></template-refer>
        <span class="text-h5 ml-auto mt-2 mr-2">{{ cardInfo.level }}</span>
      </div>
      <div class="d-flex mt-auto">
        <v-btn
          v-for="(act, i) in client.player.data.storeActs[pos]"
          :key="`Act-${i}`"
          variant="flat"
          :color="act.name === '三连' ? 'yellow' : ''"
          :disabled="model || !act.enable"
          @click="client.post(act.message, { player: client.pos, place: pos })"
          >{{ act.name }}</v-btn
        >
      </div>
    </template>
  </v-card>
</template>

<style scoped>
#storeItemRoot {
  width: 200px;
  height: 100px;
  transition: border 0.1s;
}

.selected {
  border: 2px solid black;
}
</style>
