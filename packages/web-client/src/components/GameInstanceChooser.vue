<script setup lang="ts">
import GameInstance from './GameInstance.vue'
import GameInstanceMobile from './GameInstanceMobile.vue'
import type { ClientStatus } from './types'
import type { WebClient } from './WebClient'

const props = defineProps<{
  status: ClientStatus
  client: WebClient
  mobile: boolean
}>()
</script>

<template>
  <game-instance v-if="!mobile" :status="status" :client="client">
    <slot></slot>
  </game-instance>
  <game-instance-mobile v-else :status="status" :client="client">
    <slot></slot>
  </game-instance-mobile>
</template>
