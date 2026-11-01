export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface DesktopInfo {
  name: string
  version: string
  license: string
  notice: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

export async function readDrawingPath(path: string): Promise<{ name: string; data: ArrayBuffer }> {
  const { invoke } = await import('@tauri-apps/api/core')
  const encoded = await invoke<string>('read_drawing', { path })
  return { name: fileName(path), data: base64ToBuffer(encoded) }
}

export async function pickDrawingPath(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    multiple: false,
    filters: [{ name: 'DWG / DXF', extensions: ['dwg', 'dxf'] }],
  })
  return typeof selected === 'string' ? selected : null
}

export async function saveExportFile(
  kind: 'png' | 'pdf',
  bytes: Uint8Array,
  suggestedName: string,
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({
    defaultPath: suggestedName,
    filters: [{ name: kind.toUpperCase(), extensions: [kind] }],
  })
  if (typeof selected !== 'string') return false
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('write_export', { path: selected, dataBase64: bytesToBase64(bytes) })
  return true
}

export async function fetchAppInfo(): Promise<DesktopInfo | null> {
  if (!isDesktopShell()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<DesktopInfo>('app_info')
}

export async function bindDesktopOpens(openPath: (path: string) => Promise<void>): Promise<() => void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const drain = async () => {
    const paths = await invoke<string[]>('take_pending_opens')
    for (const path of paths) await openPath(path)
  }
  await drain()
  const unlisten = await listen('open-drawing', () => {
    void drain()
  })
  let unlistenDrop = () => {}
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') return
      for (const path of event.payload.paths) {
        const lower = path.toLowerCase()
        if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) void openPath(path)
      }
    })
  } catch (error) {
    console.warn('desktop drag-drop unavailable', error)
  }
  return () => {
    unlisten()
    unlistenDrop()
  }
}

export async function noteRuntime(message: string): Promise<void> {
  if (!isDesktopShell()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('note_runtime', { message })
}
