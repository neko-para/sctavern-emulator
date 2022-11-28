<script setup lang="ts">
import { racepng } from '@/assets/racePng'
import type { Race } from '@sctavern-emulator/data/types'

const props = defineProps<{
  race: Race
}>()
</script>

<template>
  <div id="raceIconRoot" class="d-flex align-center justify-center">
    <img :src="racepng[race]" />
  </div>
</template>

<style scoped>
#raceIconRoot {
  width: 36px;
  height: 36px;
}
</style>
