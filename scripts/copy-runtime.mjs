import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dest = resolve(root, 'public/workers')
mkdirSync(dest, { recursive: true })

const files = [
  [
    'node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js',
    'libredwg-parser-worker.js',
  ],
  [
    'node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm',
    'libredwg-web.wasm',
  ],
  [
    'node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',
    'mtext-renderer-worker.js',
  ],
]

for (const [from, name] of files) {
  cpSync(resolve(root, from), resolve(dest, name))
}

console.log(`Copied CAD workers to ${dest}`)
