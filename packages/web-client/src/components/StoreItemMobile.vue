<script setup lang="ts">
import { getCard, type CardKey, tr } from 'data'
import type { Client } from 'emulator'

const props = defineProps<{
  card: CardKey | null
  model: boolean
  pos: number
  selected: boolean
  client: Client
}>()

const cardInfo = props.card ? getCard(props.card) : null
</script>

<template>
  <v-card
    id="storeItemRoot"
    class="d-flex align-center"
    :color="client.player.data.locked && card ? 'cyan' : 'white'"
    elevation="5"
    :class="{
      selected: selected,
    }"
    @click="client.selectChoose(card ? `S${pos}` : 'none')"
  >
    <template v-if="card && cardInfo">
      <div class="d-flex text-h6 mx-1 w-100" v-if="!selected">
        <span>{{ tr[cardInfo.race] }}</span>
        <span class="ml-1">{{ card }}</span>
        <span class="ml-auto">{{ cardInfo.level }}</span>
      </div>
      <div class="d-flex justify-space-around w-100" v-else>
        <v-btn
          :disabled="model || !client.player.can_buy_combine(card)"
          variant="flat"
          v-if="client.player.can_hand_combine(card)"
          @click="
            client.requestStore({
              act: 'combine',
              pos,
            })
          "
          color="yellow"
          >三连</v-btn
        >
        <v-btn
          :disabled="model || !client.player.can_buy_enter(card)"
          variant="text"
          v-else
          @click="
            client.requestStore({
              act: 'enter',
              pos,
            })
          "
          >购买</v-btn
        >
        <v-btn
          :disabled="model || !client.player.can_buy_cache(card)"
          variant="text"
          @click="
            client.requestStore({
              act: 'cache',
              pos,
            })
          "
          >暂存</v-btn
        >
      </div>
    </template>
  </v-card>
</template>

<style scoped>
#storeItemRoot {
  width: 180px;
  height: 50px;
  transition: border 0.1s;
}

.selected {
  border: 1px solid black;
}
</style>
