import { fileURLToPath, URL } from 'node:url'

import { defineConfig, searchForWorkspaceRoot } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
import vuetify from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/sctavern-emulator/',
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [
        // 搜索工作区的根目录
        searchForWorkspaceRoot(process.cwd()),
        // 自定义规则
        // 由于将依赖都装到了根目录的node_modules中，需要手动指定允许devServer访问根目录的node_modules
        '../../node_modules',
      ],
    },
  },
})
