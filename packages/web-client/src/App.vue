<script setup lang="ts">
import GameInstance from './components/GameInstance.vue'
</script>

<template>
  <div class="d-flex">
    <game-instance
      :pack="['核心']"
      :seed="Math.random().toString()"
    ></game-instance>
  </div>
</template>
