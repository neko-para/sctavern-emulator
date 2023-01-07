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
} from '@sctavern-emulator/data'
import { Shuffler, type GroupGameConfig } from '@sctavern-emulator/emulator'
import { isMobile } from '@/utils'
import {
  Compress,
  GroupClient,
  type tResult,
} from '@sctavern-emulator/framework'
import { clientFactory } from '@/websock'
import type { GroupError } from '@sctavern-emulator/framework/src/group'
import type { RemoteOption } from '@/components/types'

const router = useRouter()
const shuffler = new Shuffler(Math.random().toString())

const packConfig = ref<Record<string, boolean>>({
  核心: true,
})
const seedConfig = ref(Math.floor(Math.random() * 1000000).toString())
const roleConfig = ref<RoleKey[]>(['白板'])
const mutationConfig = ref<Record<string, boolean>>({})

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
  roleConfig.value = roleConfig.value.map(v =>
    v in AllRoleChoice.value ? v : '白板'
  )
})

const client = ref<GroupClient<GroupGameConfig> | null>(null)

async function main() {
  client.value = await GroupClient.create<GroupGameConfig>(
    clientFactory,
    'localhost',
    8080
  )
  client.value.gameStarted.connect(async info => {
    client.value?.client.close()
    router.push({
      name: 'Remote',
      query: {
        option: Compress<RemoteOption>({
          target: `ws://${info.target}:${info.port}`,
          game: info.game,
          id: info.id,
          pos: info.pos,
          config: info.config,
        }),
      },
    })
  })
  watch(() => client.value?.data.session, save)
  load()
}

main()

function load() {
  const session = localStorage.getItem('sctavern/session')
  if (session) {
    client.value?.login_session(session).then(showResult)
  }
}

function save() {
  if (client.value?.data.session) {
    localStorage.setItem('sctavern/session', client.value?.data.session)
  }
}

const tempUserName = ref('')
const tempPassword = ref('')
const errorMessage = ref('')

function showResult<T, E extends GroupError>(v: tResult<T, E>) {
  console.log(v)
  v.match(
    () => {
      errorMessage.value = ''
    },
    e => {
      errorMessage.value = e
    }
  )
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
          <template v-if="client">
            <template v-if="client.data.state === 0">
              <v-card-title>登录或注册</v-card-title>
              <v-card-subtitle v-if="errorMessage">{{
                errorMessage
              }}</v-card-subtitle>
              <v-card-text>
                <v-text-field
                  v-model="tempUserName"
                  label="用户"
                ></v-text-field>
                <v-text-field
                  v-model="tempPassword"
                  label="密码"
                  type="password"
                ></v-text-field>
              </v-card-text>
              <v-card-actions>
                <v-btn
                  @click="
                    client?.login(tempUserName, tempPassword).then(showResult)
                  "
                  >登录</v-btn
                >
                <v-btn
                  @click="
                    client
                      ?.register(tempUserName, tempPassword)
                      .then(showResult)
                  "
                  >注册</v-btn
                >
              </v-card-actions>
            </template>
            <template v-else-if="client.data.state === 1">
              <v-card-title>你好 {{ client.data.name }}</v-card-title>
              <v-card-subtitle v-if="errorMessage">{{
                errorMessage
              }}</v-card-subtitle>
              <v-card-actions>
                <v-btn @click="client?.new_group().then(showResult)"
                  >创建房间</v-btn
                >
              </v-card-actions>
              <v-card-text>
                <v-row
                  v-for="(g, i) in client.data.group_list"
                  :key="`Group-${i}`"
                >
                  <v-col cols="2">
                    <v-btn @click="client?.enter_group(g.id)">加入</v-btn>
                  </v-col>
                  <v-col>
                    <span class="text-h6">{{ g.name }}</span>
                  </v-col>
                </v-row>
              </v-card-text>
            </template>
            <template v-else-if="client.data.state === 2">
              <v-card-title
                >已进入房间 {{ client.data.group?.name }}</v-card-title
              >
              <v-card-subtitle v-if="errorMessage">{{
                errorMessage
              }}</v-card-subtitle>
              <v-card-actions>
                <v-btn @click="client?.leave_group().then(showResult)"
                  >离开房间</v-btn
                >
                <v-btn @click="client?.start_game().then(showResult)"
                  >开始游戏</v-btn
                >
              </v-card-actions>
              <v-card-text>
                <v-row
                  v-for="(u, i) in client.data.group?.player"
                  :key="`GroupPlayer-${i}`"
                >
                  <v-col cols="2">
                    <span v-if="u === client.data.group?.owner" class="text-h6"
                      >房主</span
                    >
                  </v-col>
                  <v-col cols="2">
                    <span v-if="u === client.data.id" class="text-h6">你</span>
                  </v-col>
                  <v-col>
                    <span class="text-h6">{{
                      client.data.group?.playerNames[i]
                    }}</span>
                  </v-col>
                </v-row>
              </v-card-text>
              <v-card-text>
                {{ client.data.group }}
              </v-card-text>
            </template>
          </template>
          <template v-else>
            <v-card-text>连接中……</v-card-text>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-layout>
</template>
