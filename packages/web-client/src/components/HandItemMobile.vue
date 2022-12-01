<script setup lang="ts">
import { computed } from 'vue'
import { getCard, type CardKey } from '@sctavern-emulator/data'
import type { Client } from '@sctavern-emulator/emulator'

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
</script>

<template>
  <v-card
    id="handItemRoot"
    class="d-flex align-center justify-space-around"
    elevation="5"
    :class="{
      selected: selected,
    }"
    @click="client.selectChoose(card ? `H${pos}` : 'none')"
  >
    <template v-if="card && cardInfo">
      <div class="d-flex mx-1 w-100" v-if="!selected">
        <span>{{ cardInfo.race }}{{ cardInfo.level }}</span>
        <span class="ml-1">{{ card }}</span>
      </div>
      <div class="d-flex justify-space-around w-100" v-else>
        <v-btn
          v-for="(act, i) in client.player.data.handActs[pos]"
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
#handItemRoot {
  width: 160px;
  height: 40px;
  transition: border 0.1s;
}

.selected {
  border: 1px solid black;
}
</style>
