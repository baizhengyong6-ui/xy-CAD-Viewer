import { fileIo } from '@kit.CoreFileKit'
import { Want } from '@kit.AbilityKit'

const LIMIT_BYTES = 96 * 1024 * 1024

export interface InboxItem {
  name: string
  bytes: Uint8Array
}

type OpenListener = (id: string, name: string) => void
type MemoryListener = () => void

const items: Map<string, InboxItem> = new Map()
const openListeners: OpenListener[] = []
const memoryListeners: MemoryListener[] = []
let sequence: number = 1
let pendingId: string = ''
let pendingName: string = ''
let pendingMemory: boolean = false

export class CadInbox {
  static subscribe(onOpen: OpenListener, onMemory: MemoryListener): void {
    openListeners.push(onOpen)
    memoryListeners.push(onMemory)
    if (pendingMemory) onMemory()
    if (pendingId.length > 0) onOpen(pendingId, pendingName)
  }

  static take(id: string): Uint8Array | undefined {
    const item = items.get(id)
    if (item === undefined) return undefined
    items.delete(id)
    return item.bytes
  }

  static importUri(uri: string): void {
    const name = fileNameFromUri(uri)
    if (!isDrawing(name)) return
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)
    try {
      const stat = fileIo.statSync(file.fd)
      if (stat.size > LIMIT_BYTES) {
        pendingMemory = true
        memoryListeners.forEach((listener: MemoryListener) => listener())
        return
      }
      const buffer = new ArrayBuffer(stat.size)
      fileIo.readSync(file.fd, buffer)
      CadInbox.put(name, new Uint8Array(buffer))
    } finally {
      fileIo.closeSync(file)
    }
  }

  static importWant(want: Want): void {
    const uri = want.uri
    if (uri === undefined || uri.length === 0) return
    CadInbox.importUri(uri)
  }

  private static put(name: string, bytes: Uint8Array): void {
    const id = `${Date.now()}-${sequence}`
    sequence += 1
    const item: InboxItem = { name: name, bytes: bytes }
    items.set(id, item)
    pendingId = id
    pendingName = name
    openListeners.forEach((listener: OpenListener) => listener(id, name))
  }
}

function fileNameFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri)
  const slash = Math.max(decoded.lastIndexOf('/'), decoded.lastIndexOf('\\'))
  return slash >= 0 ? decoded.substring(slash + 1) : decoded
}

function isDrawing(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.dwg') || lower.endsWith('.dxf')
}
