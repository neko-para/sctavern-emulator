<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CardInstance, Client } from '@sctavern-emulator/emulator'
import { AllCard, type CardKey } from '@sctavern-emulator/data'
import type { UnitKey } from '@sctavern-emulator/data'
import TemplateRefer from './TemplateRefer.vue'
import InstanceRefer from './InstanceRefer.vue'
import RaceIcon from './RaceIcon.vue'

const props = defineProps<{
  card: CardInstance | null
  model: boolean
  pos: number
  insert: boolean
  selected: boolean
  client: Client
}>()

const allUnit = computed(() => {
  const us: {
    [u in UnitKey]?: number
  } = {}
  props.card?.data.units.forEach(u => {
    us[u] = (us[u] || 0) + 1
  })
  return Object.keys(us).map(u => `${u}: ${us[u as UnitKey]}`)
})

const Color = {
  normal: 'white',
  gold: 'yellow',
  darkgold: 'amber',
}

const elv = ref(5)
</script>

<template>
  <v-card
    id="presentItemRoot"
    class="d-flex flex-column space-between"
    :color="card ? Color[card.data.color] : 'white'"
    :elevation="elv"
    :class="{
      selected: selected,
    }"
    @mouseover="elv = 10"
    @mouseout="elv = 5"
    @click="client.selectChoose(card ? `P${pos}` : 'none')"
  >
    <template v-if="card">
      <div class="d-flex">
        <race-icon class="mt-1" :race="card.data.race"></race-icon>
        <template-refer
          v-if="AllCard.includes(card.data.name as CardKey)"
          :card="card.data.name as CardKey"
        ></template-refer>
        <span v-else class="text-h5 mt-2">{{ card.data.name }}</span>
        <div class="ml-auto"></div>
        <instance-refer :card="card"></instance-refer>
        <span class="text-h5 ml-1 mt-2 mr-2">{{ card.data.level }}</span>
      </div>
      <div class="d-flex ma-1">
        <span class="text-h5">{{ card.value() }}</span>
      </div>
      <div class="d-flex">
        <div class="d-flex flex-column">
          <span
            class="mx-1"
            v-for="(a, i) in card.attribs()"
            :key="`Attrib-${i}`"
          >
            {{ a }}
          </span>
        </div>
        <div class="d-flex flex-column ml-auto mr-1">
          <span v-for="(u, i) in card.data.upgrades" :key="`Upgrade-${i}`">{{
            u
          }}</span>
        </div>
      </div>
      <div class="d-flex mt-auto ml-1">
        <div class="d-flex flex-column align-self-end">
          <span v-for="(s, i) in allUnit.slice(0, 5)" :key="`Unit-${i}`">{{
            s
          }}</span>
          <v-tooltip location="top">
            <template v-slot:activator="{ props: p }">
              <span style="cursor: pointer" v-bind="p"
                >{{ card.data.units.length }} /
                {{ client.player.config.MaxUnitPerCard }}</span
              >
            </template>
            <pre>{{ allUnit.join('\n') }}</pre>
          </v-tooltip>
        </div>
      </div>
      <div class="d-flex">
        <v-btn
          :disabled="model || !client.player.can_pres_upgrade(card)"
          variant="text"
          @click="
            client.requestPresent({
              act: 'upgrade',
              pos,
            })
          "
          >升级</v-btn
        >
        <v-btn
          :disabled="model"
          variant="text"
          @click="
            client.requestPresent({
              act: 'sell',
              pos,
            })
          "
          >出售</v-btn
        >
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
      </div>
    </template>
    <template v-else>
      <v-btn
        class="mt-auto ml-auto"
        v-if="insert"
        variant="text"
        @click="
          client.insertChoose({
            pos,
          })
        "
        >这里</v-btn
      >
    </template>
  </v-card>
</template>

<style scoped>
#presentItemRoot {
  width: 250px;
  height: 350px;
  transition: border 0.1s;
}

.selected {
  border: 2px solid black;
}
</style>
