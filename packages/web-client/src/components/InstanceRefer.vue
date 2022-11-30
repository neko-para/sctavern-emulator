<script setup lang="ts">
import type { CardInstanceAttrib } from '@sctavern-emulator/emulator'

const props = defineProps<{
  card: CardInstanceAttrib
}>()
</script>

<template>
  <v-tooltip location="bottom">
    <template v-slot:activator="{ props: p }">
      <span style="cursor: pointer" v-bind="p" class="mt-3">当前描述</span>
    </template>
    <div class="d-flex flex-column">
      <pre>{{
        card.descriptors
          .map(v => v.text.replace(/<([^>]+?)>/g, '$1'))
          .join('\n')
      }}</pre>
    </div>
  </v-tooltip>
</template>
