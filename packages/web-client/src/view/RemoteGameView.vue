<script setup lang="ts">
import { useRoute } from 'vue-router'
import RemoteGame from '@/components/RemoteGame.vue'
import { isMobile } from '@/utils'

const route = useRoute()

const target = route.query.target as string
const pos = route.query.pos as string
</script>

<template>
  <remote-game
    :target="target"
    :pos="Number(pos)"
    :mobile="isMobile()"
  ></remote-game>
</template>
