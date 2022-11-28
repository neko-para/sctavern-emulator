<script setup lang="ts">
import { ref } from 'vue'
import { type RoleKey, AllRole, order } from '@sctavern-emulator/data'
import { Shuffler } from '@sctavern-emulator/emulator'
import { applyConfigChange } from './utils'

const packConfig = ref<Record<string, boolean>>({})
const seedConfig = ref(Math.floor(Math.random() * 1000000).toString())
const roleConfig = ref<RoleKey>('白板')
const packDlg = ref(false)

function genPackConfig() {
  const res: Record<string, boolean> = {
    核心: true,
  }
  new Shuffler(Math.random().toString())
    .shuffle(order.pack.slice(1))
    .slice(0, 2)
    .forEach(p => {
      res[p] = true
    })
  packConfig.value = res
}

function genSeed() {
  seedConfig.value = Math.floor(Math.random() * 1000000).toString()
}
</script>

<template>
  <v-dialog v-model="packDlg" class="w-25">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props">配置</v-btn>
    </template>
    <v-card>
      <v-card-title>配置</v-card-title>
      <v-card-text>
        <v-text-field v-model="seedConfig" label="种子"></v-text-field>
        <v-select v-model="roleConfig" :items="AllRole"></v-select>
        <v-checkbox
          hide-details
          :disabled="i === 0"
          v-for="(p, i) in order.pack"
          :key="`pack-${i}`"
          v-model="packConfig[p]"
          :label="p"
        ></v-checkbox>
      </v-card-text>
      <v-card-actions>
        <v-btn
          @click="
            applyConfigChange({
              pack: Object.keys(packConfig),
              seed: seedConfig,
              role: [roleConfig],
            })
          "
          color="red"
          >确认(会刷新当前游戏)</v-btn
        >
        <v-btn @click="genPackConfig()">随机两个扩展包</v-btn>
        <v-btn @click="genSeed()">随机种子</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
