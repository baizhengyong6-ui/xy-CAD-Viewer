import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  const buf = readFileSync(resolve(root, path))
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }
  return buf.toString('utf8')
}

/** UUID v5 (SHA-1), the same construction Tauri uses for the WiX upgrade code. */
function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1').update(ns).update(name, 'utf8').digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const UPGRADE_CODE = 'fd8004ce-56c7-5ee2-94da-ab2f916d3abd'
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

describe('Windows installer identity stays stable', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'))

  it('keeps the app identifier', () => {
    expect(config.identifier).toBe('com.xinyao.cadviewer')
    expect(config.productName).toBe('XinyaoCADViewer')
    expect(config.mainBinaryName).toBe('xinyao-cad-viewer')
  })

  it('pins the WiX upgrade code used since v0.3.2', () => {
    expect(String(config.bundle.windows.wix.upgradeCode).toLowerCase()).toBe(UPGRADE_CODE)
    const derived = uuidV5(`${config.productName}.exe.app.x64`, DNS)
    expect(derived).toBe(UPGRADE_CODE)
  })

  it('keeps per-user NSIS and points at the shortcut hooks', () => {
    expect(config.bundle.windows.nsis.installMode).toBe('currentUser')
    expect(config.bundle.windows.nsis.installerHooks).toBe('windows/installer-hooks.nsh')
    const hooks = read('src-tauri/windows/installer-hooks.nsh')
    expect(hooks).toContain('NSIS_HOOK_PREINSTALL')
    expect(hooks).toContain('NSIS_HOOK_POSTINSTALL')
    expect(hooks).toContain('NSIS_HOOK_POSTUNINSTALL')
    expect(hooks).toContain('XinyaoCADViewer.lnk')
    expect(hooks).toContain('鑫垚CAD看图.lnk')
    expect(hooks).toContain('msiexec')
  })

  it('ships the MSI shortcut cleanup script from the WiX fragment', () => {
    const script = read('src-tauri/windows/remove-stale-shortcuts.vbs')
    const wxs = read('src-tauri/windows/cleanup-shortcuts.wxs')
    expect(script).toContain('XinyaoCADViewer.lnk')
    expect(script).toContain('鑫垚CAD看图.lnk')
    expect(script).toContain('uninstall.exe')
    expect(wxs).toContain('remove-stale-shortcuts.vbs')
    expect(wxs).toContain('StaleShortcutCleanup')
    expect(wxs).toContain('VBScriptCall="CleanupShortcuts"')
    expect(script).toContain('Sub CleanupShortcuts')
    expect(config.bundle.windows.wix.fragmentPaths).toContain('windows/cleanup-shortcuts.wxs')
    expect(config.bundle.windows.wix.componentRefs).toContain('StaleShortcutCleanup')
  })
})
