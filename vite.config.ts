/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const tauriHost = process.env.TAURI_DEV_HOST

export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [vue()],
  server: {
    host: tauriHost || '127.0.0.1',
    port: 43123,
    strictPort: true,
    hmr: tauriHost
      ? {
          protocol: 'ws',
          host: tauriHost,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      '@mlightcad/cad-simple-viewer',
      '@mlightcad/data-model',
      '@mlightcad/libredwg-converter',
      '@mlightcad/mtext-renderer',
      '@mlightcad/three-renderer',
      'three',
      'lodash-es',
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
