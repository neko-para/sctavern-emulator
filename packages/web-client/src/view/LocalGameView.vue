<script setup lang="ts">
import { useRoute } from 'vue-router'
import LocalGame from '@/components/LocalGame.vue'
import { isMobile } from '@/utils'

const route = useRoute()

const replay = route.query.replay as string
</script>

<template>
  <local-game :replay="replay" :mobile="isMobile()"></local-game>
</template>
