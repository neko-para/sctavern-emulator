<script setup lang="ts">
import type { RoleKey } from 'data'
import GameInstance from './components/GameInstance.vue'

const params = new URLSearchParams(window.location.search.substring(1))

const packs = params.get('pack')?.split(',') || ['核心']
const seed =
  params.get('seed') || Math.floor(Math.random() * 1000000).toString()
const role = (params.get('role') || '白板') as RoleKey
const replay = params.get('replay')
</script>

<template>
  <div class="d-flex">
    <game-instance
      :pack="packs"
      :seed="seed"
      :role="role"
      :replay="replay"
    ></game-instance>
  </div>
</template>
