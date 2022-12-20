<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  type RoleKey,
  order,
  AllRole,
  getRole,
  type MutationKey,
  getMutation,
  AllMutation,
} from '@sctavern-emulator/data'
import {
  type LogItem,
  Shuffler,
  type GameReplay,
} from '@sctavern-emulator/emulator'
import { compress, decompress, isMobile } from '@/utils'

const router = useRouter()
const shuffler = new Shuffler(Math.random().toString())

const type = ref<'local' | 'remote'>('local')

const packConfig = ref<Record<string, boolean>>({
  核心: true,
})
const seedConfig = ref(Math.floor(Math.random() * 1000000).toString())
const roleConfig = ref<RoleKey>('白板')
const logConfig = ref<LogItem[]>([])
const mutationConfig = ref<Record<string, boolean>>({})
const replayConfig = ref('')
const intervalConfig = ref('100')
const importDlg = ref(false)

function genPackConfig() {
  const res: Record<string, boolean> = {
    核心: true,
  }
  shuffler
    .shuffle(order.pack.slice(1))
    .slice(0, 2)
    .forEach(p => {
      res[p] = true
    })
  packConfig.value = res
}

function getPacks() {
  return Object.keys(packConfig.value).filter(p => packConfig.value[p])
}

function genSeed() {
  seedConfig.value = Math.floor(Math.random() * 1000000).toString()
}

const AllRoleChoice = computed<RoleKey[]>(() => {
  return AllRole.filter(r => !getRole(r).ext).filter(r => {
    for (const m in mutationConfig.value) {
      if (!mutationConfig.value[m]) {
        continue
      }
      if (getMutation(m as MutationKey).prole === r) {
        return false
      }
    }
    return true
  })
})

watch(AllRoleChoice, () => {
  if (!(roleConfig.value in AllRoleChoice.value)) {
    roleConfig.value = '白板'
  }
})

function genRole() {
  roleConfig.value = shuffler.shuffle(AllRoleChoice.value.map(x => x))[0]
}

function loadReplay() {
  const replay = decompress(replayConfig.value) as GameReplay
  packConfig.value = {
    核心: true,
  }
  replay.pack.forEach(p => {
    packConfig.value[p] = true
  })
  seedConfig.value = replay.seed
  roleConfig.value = replay.role[0]
  logConfig.value = replay.log
  mutationConfig.value = {}
  replay.mutation.forEach(m => {
    mutationConfig.value[m] = true
  })
  importDlg.value = false
}

const targetConfig = ref('localhost:8080')
const posConfig = ref(0)

function apply() {
  if (type.value === 'local') {
    const replay = compress({
      pack: getPacks(),
      seed: seedConfig.value,
      role: [roleConfig.value],
      mutation: Object.keys(mutationConfig.value).filter(
        k => mutationConfig.value[k]
      ),
      log: logConfig.value,
    })
    router.push({
      name: 'Local',
      query: {
        replay: replay,
        interval: intervalConfig.value,
      },
    })
  } else {
    router.push({
      name: 'Remote',
      query: {
        target: `ws://${targetConfig.value}`,
        pos: posConfig.value,
      },
    })
  }
}
</script>

<template>
  <v-layout>
    <v-row>
      <v-col>
        <v-card
          class="mx-auto mt-4"
          :class="{
            'w-50': !isMobile(),
          }"
          elevation="10"
        >
          <v-card-text>
            <v-radio-group v-model="type" inline>
              <v-radio value="local" label="本地"></v-radio>
              <v-radio value="remote" label="远程" disabled></v-radio>
            </v-radio-group>
          </v-card-text>
          <template v-if="type === 'local'">
            <v-card-text>
              <v-row>
                <v-col cols="1"></v-col>
                <v-col cols="8">
                  <v-text-field
                    v-model="seedConfig"
                    label="种子"
                  ></v-text-field>
                </v-col>
                <v-col cols="2">
                  <v-btn @click="genSeed()">随机</v-btn>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="1"></v-col>
                <v-col cols="8">
                  <v-select
                    v-model="roleConfig"
                    :items="AllRoleChoice"
                  ></v-select>
                </v-col>
                <v-col cols="2">
                  <v-btn @click="genRole()">随机</v-btn>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="1"></v-col>
                <v-col v-for="x in 2" cols="4" :key="`pack-col-${x}`">
                  <v-checkbox
                    hide-details
                    :disabled="i === 0 && x === 1"
                    v-for="(p, i) in order.pack.slice(x * 4 - 4, x * 4)"
                    :key="`pack-${i}-${x}`"
                    v-model="packConfig[p]"
                    :label="p"
                  ></v-checkbox>
                </v-col>
                <v-col cols="2">
                  <v-btn @click="genPackConfig()">随机</v-btn>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="1"></v-col>
                <v-col v-for="x in 2" cols="4" :key="`muta-col-${x}`">
                  <v-checkbox
                    hide-details
                    v-for="(m, i) in AllMutation.slice(x * 4 - 4, x * 4)"
                    :key="`muta-${i}-${x}`"
                    v-model="mutationConfig[m]"
                    :label="m"
                  ></v-checkbox>
                </v-col>
              </v-row>

              <v-row v-if="logConfig.length > 0">
                <v-col cols="1"></v-col>
                <v-col cols="8">
                  <v-text-field
                    label="等待时延"
                    suffix="ms"
                    v-model="intervalConfig"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-card-text>
          </template>
          <template v-else>
            <v-card-text>
              <v-row>
                <v-col>
                  <v-text-field
                    v-model="targetConfig"
                    label="服务器"
                    prefix="ws://"
                  ></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-text-field v-model="posConfig" label="位置"></v-text-field>
                </v-col>
              </v-row>
            </v-card-text>
          </template>
          <v-card-actions>
            <v-btn color="red" @click="apply()">确认</v-btn>

            <v-dialog
              v-if="type === 'local'"
              v-model="importDlg"
              :class="{
                'w-50': !isMobile(),
              }"
            >
              <template v-slot:activator="{ props: p }">
                <v-btn v-bind="p">导入</v-btn>
              </template>
              <v-card>
                <v-card-title>导入</v-card-title>
                <v-card-text>
                  <v-textarea hide-details v-model="replayConfig"></v-textarea>
                </v-card-text>
                <v-card-actions>
                  <v-btn @click="loadReplay()">导入</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
            <v-btn v-if="logConfig.length > 0" @click="logConfig = []"
              >移除{{ logConfig.length }}个操作</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-layout>
</template>
