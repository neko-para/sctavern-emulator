<script setup lang="ts">
import { ref, computed } from 'vue'
import { getCard, type CardKey, tr } from '@sctavern-emulator/data'
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
          :disabled="model || !client.player.data.handActs[pos].eE"
          variant="flat"
          :color="
            client.player.data.handActs[pos].e === 'combine' ? 'yellow' : ''
          "
          @click="
            client.requestHand({ act: client.player.data.handActs[pos].e, pos })
          "
          >{{
            client.player.data.handActs[pos].e === 'combine' ? '三连' : '进场'
          }}</v-btn
        >
        <v-btn
          :disabled="model || !client.player.data.handActs[pos].sE"
          variant="flat"
          @click="
            client.requestHand({ act: client.player.data.handActs[pos].s, pos })
          "
          >出售</v-btn
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
