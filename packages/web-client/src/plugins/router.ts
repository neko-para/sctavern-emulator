import { createRouter, createWebHashHistory } from 'vue-router'
import GameSetupLocalView from '@/view/GameSetupLocalView.vue'
import GameSetupRemoteView from '@/view/GameSetupRemoteView.vue'
import LocalGameView from '@/view/LocalGameView.vue'
import RemoteGameView from '@/view/RemoteGameView.vue'

const routes = [
  {
    name: 'Setup',
    path: '/',
    component: GameSetupLocalView,
  },
  {
    name: 'SetupRemote',
    path: '/setup/remote',
    component: GameSetupRemoteView,
  },
  {
    name: 'Local',
    path: '/local',
    component: LocalGameView,
  },
  {
    name: 'Remote',
    path: '/remote',
    component: RemoteGameView,
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
