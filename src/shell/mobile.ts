import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface DrawingRef {
  name: string
  path: string
  error?: string
}

interface XinyaoFilesPlugin {
  pick(): Promise<{ canceled?: boolean; name?: string; path?: string }>
  consumePending(): Promise<{ empty?: boolean; name?: string; path?: string; error?: string }>
  share(options: { name: string; mime: string; dataBase64: string }): Promise<void>
  addListener(
    eventName: 'drawing',
    listener: (event: DrawingRef) => void,
  ): Promise<PluginListenerHandle>
}

const XinyaoFiles = registerPlugin<XinyaoFilesPlugin>('XinyaoFiles')

export function isAndroidShell(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export function isHarmonyShell(): boolean {
  if (typeof navigator === 'undefined') return false
  const agent = navigator.userAgent
  return agent.includes('ArkWeb') || agent.includes('OpenHarmony')
}

export function isMobileShell(): boolean {
  return isAndroidShell() || isHarmonyShell()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function openAndroidPath(name: string, path: string): Promise<void> {
  const url = Capacitor.convertFileSrc(path)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`read ${response.status}`)
  const data = await response.arrayBuffer()
  await window.openCadFile(name, data)
}

export async function openAndroidDrawing(): Promise<void> {
  const picked = await XinyaoFiles.pick()
  if (picked.canceled || !picked.name || !picked.path) return
  await openAndroidPath(picked.name, picked.path)
}

export async function bindAndroidOpens(onError: (error: unknown) => void): Promise<() => void> {
  const open = async (name: string, path: string) => {
    try {
      await openAndroidPath(name, path)
    } catch (error) {
      onError(error)
    }
  }
  const pending = await XinyaoFiles.consumePending()
  if (pending.error) onError(new Error(pending.error))
  else if (!pending.empty && pending.name && pending.path) await open(pending.name, pending.path)
  const handle = await XinyaoFiles.addListener('drawing', (event) => {
    if (event.error) onError(new Error(event.error))
    else void open(event.name, event.path)
  })
  return () => {
    void handle.remove()
  }
}

export async function shareMobileFile(kind: 'png' | 'pdf', bytes: Uint8Array, suggestedName: string): Promise<void> {
  if (isAndroidShell()) {
    await XinyaoFiles.share({
      name: suggestedName,
      mime: kind === 'png' ? 'image/png' : 'application/pdf',
      dataBase64: bytesToBase64(bytes),
    })
    return
  }
  const harmony = window.XinyaoHarmony
  if (!harmony) throw new Error('harmony share unavailable')
  harmony.share(suggestedName, kind === 'png' ? 'image/png' : 'application/pdf', bytesToBase64(bytes))
}

export function requestHarmonyPick(): void {
  window.XinyaoHarmony?.pick()
}
