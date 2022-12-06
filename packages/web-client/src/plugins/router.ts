import { createRouter, createWebHashHistory } from 'vue-router'
import GameSetupView from '@/view/GameSetupView.vue'
import LocalGameView from '@/view/LocalGameView.vue'
import RemoteGameView from '@/view/RemoteGameView.vue'

const routes = [
  {
    name: 'Setup',
    path: '/',
    component: GameSetupView,
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
