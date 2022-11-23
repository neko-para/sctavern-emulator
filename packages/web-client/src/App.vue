<script setup lang="ts">
import GameInstance from './components/GameInstance.vue'

const params = new URLSearchParams(window.location.search.substring(1))

const packs = params.get('pack')?.split(',') || ['核心']
const seed =
  params.get('seed') || Math.floor(Math.random() * 1000000).toString()
const replay = params.get('replay')
</script>

<template>
  <div class="d-flex">
    <game-instance :pack="packs" :seed="seed" :replay="replay"></game-instance>
  </div>
</template>
