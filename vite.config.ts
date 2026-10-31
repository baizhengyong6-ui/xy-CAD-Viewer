/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
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
    include: ['src/**/*.test.ts'],
  },
})
