<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CardInstance, Client } from 'emulator'
import { AllCard, type CardKey, tr } from 'data'
import type { UnitKey } from 'data'

const props = defineProps<{
  card: CardInstance
  model: boolean
  pos: number
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
</script>

<template>
  <v-card
    id="presentItemRoot"
    class="d-flex flex-column ml-2 mb-2"
    :color="card ? Color[card.data.color] : 'white'"
    elevation="5"
  >
    <div class="d-flex justify-space-around mx-1 mt-1">
      <v-dialog>
        <template v-slot:activator="{ props: p }">
          <v-btn v-bind="p" variant="text">描述</v-btn>
        </template>
        <v-card>
          <v-card-text>
            <pre style="white-space: break-spaces">{{
              card.data.descs
                .map(v => v.text[v.gold ? 1 : 0].replace(/<([^>]+?)>/g, '$1'))
                .join('\n')
            }}</pre>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-dialog>
        <template v-slot:activator="{ props: p }">
          <v-btn v-bind="p" variant="text">单位</v-btn>
        </template>
        <v-card>
          <v-card-text>
            <pre>{{ allUnit.join('\n') }}</pre>
          </v-card-text>
        </v-card>
      </v-dialog>
    </div>
    <span class="mx-1 mt-1">价值: {{ card.value() }}</span>
    <div class="d-flex ma-1"></div>
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

        <span
          >{{ card.data.units.length }} /
          {{ client.player.config.MaxUnitPerCard }}</span
        >
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
    </div>
  </v-card>
</template>

<style scoped>
#presentItemRoot {
  width: 180px;
  transition: border 0.1s;
}
</style>
