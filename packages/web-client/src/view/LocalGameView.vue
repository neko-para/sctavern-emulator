<script setup lang="ts">
import { useRoute } from 'vue-router'
import LocalGame from '@/components/LocalGame.vue'
import { isMobile } from '@/utils'

const route = useRoute()

const replay = route.query.replay as string
const interval = Number(route.query.interval as string) || 0
</script>

<template>
  <local-game
    :replay="replay"
    :interval="interval"
    :mobile="isMobile()"
  ></local-game>
</template>
