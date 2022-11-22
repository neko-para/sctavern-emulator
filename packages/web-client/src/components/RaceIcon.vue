<script setup lang="ts">
import { racepng } from '@/assets/racePng'
import type { Race } from 'data/types'

const props = defineProps<{
  race: Race
}>()
</script>

<template>
  <div id="root" class="d-flex align-center justify-center">
    <img :src="racepng[race]" />
  </div>
</template>

<style scoped>
#root {
  width: 36px;
  height: 36px;
}
</style>
