<script setup lang="ts">
import type { RoleKey } from '@sctavern-emulator/data'
import LocalGame from './components/LocalGame.vue'
import RemoteGame from './components/RemoteGame.vue'

const params = new URLSearchParams(window.location.search.substring(1))

const pos = params.get('pos') !== null ? Number(params.get('pos')) : null

const packs = params.get('pack')?.split(',') || ['核心']
const seed =
  params.get('seed') || Math.floor(Math.random() * 1000000).toString()
const role = (params.get('role') || '白板') as RoleKey
const replay = params.get('replay')

const agent = navigator.userAgent
const mobile =
  agent.indexOf('Android') > -1 ||
  agent.indexOf('iPhone') > -1 ||
  agent.indexOf('iPad') > -1 ||
  agent.indexOf('iPod') > -1 ||
  agent.indexOf('Symbian') > -1
</script>

<template>
  <div class="d-flex h-100">
    <template v-if="pos !== null">
      <remote-game
        target="ws://localhost:8080"
        :pos="pos"
        :mobile="mobile"
      ></remote-game>
    </template>
    <template v-else>
      <local-game
        :pack="packs"
        :seed="seed"
        :role="role"
        :replay="replay"
        :mobile="mobile"
      ></local-game>
    </template>
  </div>
</template>
