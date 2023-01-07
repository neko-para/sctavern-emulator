<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import RemoteGame from '@/components/RemoteGame.vue'
import { isMobile } from '@/utils'
import { Decompress } from '@sctavern-emulator/framework'
import type { RemoteOption } from '@/components/types'

const route = useRoute()
const router = useRouter()

const option =
  Decompress<RemoteOption>(route.query.option as string) ||
  (() => {
    router.back()
    return {} as RemoteOption
  })()
</script>

<template>
  <remote-game
    :target="option.target"
    :game="option.game"
    :id="option.id"
    :pos="option.pos"
    :config="option.config"
    :mobile="isMobile()"
  ></remote-game>
</template>
