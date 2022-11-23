<script setup lang="ts">
import { getCard, type CardKey } from 'data'

const props = defineProps<{
  card: CardKey
}>()

const ci = getCard(props.card)
</script>

<template>
  <v-tooltip location="bottom">
    <template v-slot:activator="{ props: p }">
      <span style="cursor: pointer" v-bind="p" class="text-h5 mt-2">{{
        card
      }}</span>
    </template>
    <div class="d-flex flex-column">
      <pre>{{
        ci.desc.map(([n, g]) => n.replace(/<([^>]+?)>/g, '$1')).join('\n')
      }}</pre>
      <span class="w-100" style="border-bottom: 1px solid white"></span>
      <pre>{{
        ci.desc.map(([n, g]) => g.replace(/<([^>]+?)>/g, '$1')).join('\n')
      }}</pre>
    </div>
  </v-tooltip>
</template>
