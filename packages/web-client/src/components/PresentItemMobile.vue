<script setup lang="ts">
import type { CardInstanceAttrib, Client } from '@sctavern-emulator/emulator'

const props = defineProps<{
  card: CardInstanceAttrib | null
  model: boolean
  pos: number
  insert: boolean
  deploy: boolean
  selected: boolean
  client: Client
}>()

const Color = {
  normal: 'white',
  gold: 'yellow',
  darkgold: 'amber',
}
</script>

<template>
  <v-card
    id="presentItemRoot"
    class="d-flex align-center"
    :color="card ? Color[card.color] : 'white'"
    elevation="5"
    :class="{
      selected: selected,
    }"
    @click="client.selectChoose(card ? `P${pos}` : 'none')"
  >
    <div class="d-flex mx-1 w-100">
      <template v-if="card">
        <span>{{ card.race }}{{ card.level }}</span>
        <span class="ml-1">{{ card.name }}</span>
      </template>
      <v-btn
        class="ml-auto"
        v-if="insert"
        variant="text"
        @click="
          client.insertChoose({
            pos,
          })
        "
        >这里</v-btn
      >
      <v-btn
        class="ml-auto"
        v-if="deploy"
        variant="text"
        @click="
          client.deployChoose({
            pos,
          })
        "
        >这里</v-btn
      >
    </div>
  </v-card>
</template>

<style scoped>
#presentItemRoot {
  width: 160px;
  height: 40px;
  transition: border 0.1s;
}

.selected {
  border: 1px solid black;
}
</style>
