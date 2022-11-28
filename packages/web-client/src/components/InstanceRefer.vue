<script setup lang="ts">
import type { CardInstance } from '@sctavern-emulator/emulator'

const props = defineProps<{
  card: CardInstance
}>()
</script>

<template>
  <v-tooltip location="bottom">
    <template v-slot:activator="{ props: p }">
      <span style="cursor: pointer" v-bind="p" class="mt-3">当前描述</span>
    </template>
    <div class="d-flex flex-column">
      <pre>{{
        card.data.descs
          .map(v => v.text[v.gold ? 1 : 0].replace(/<([^>]+?)>/g, '$1'))
          .join('\n')
      }}</pre>
    </div>
  </v-tooltip>
</template>
