import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('version 0.3.1 is the same everywhere installers read it', () => {
  const expected = '0.3.1'

  it('matches package.json, Tauri, Android, and HarmonyOS', () => {
    expect(JSON.parse(read('package.json')).version).toBe(expected)
    expect(JSON.parse(read('src-tauri/tauri.conf.json')).version).toBe(expected)
    expect(read('src-tauri/Cargo.toml')).toContain(`version = "${expected}"`)
    expect(read('android/app/build.gradle')).toContain(`versionName "${expected}"`)
    expect(read('harmony/AppScope/app.json5')).toContain(`"versionName": "${expected}"`)
    expect(read('harmony/entry/oh-package.json5')).toContain(`"version": "${expected}"`)
  })
})
