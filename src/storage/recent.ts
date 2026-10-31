export interface RecentFile {
  id: string
  name: string
  size: number
  openedAt: number
  stored: boolean
}

const DB_NAME = 'lantu'
const DB_VERSION = 1
const META = 'meta'
const BLOBS = 'blobs'
const MAX_ITEMS = 8
const MAX_BLOB_BYTES = 30 * 1024 * 1024

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listRecent(): Promise<RecentFile[]> {
  const db = await openDb()
  const rows = await requestToPromise(db.transaction(META).objectStore(META).getAll() as IDBRequest<RecentFile[]>)
  db.close()
  return rows.sort((a, b) => b.openedAt - a.openedAt)
}

export async function rememberFile(name: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb()
  const id = `${name}:${data.byteLength}`
  const stored = data.byteLength <= MAX_BLOB_BYTES
  const record: RecentFile = {
    id,
    name,
    size: data.byteLength,
    openedAt: Date.now(),
    stored,
  }
  const tx = db.transaction([META, BLOBS], 'readwrite')
  tx.objectStore(META).put(record)
  if (stored) tx.objectStore(BLOBS).put(data, id)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  const all = await requestToPromise(
    db.transaction(META).objectStore(META).getAll() as IDBRequest<RecentFile[]>,
  )
  const extras = all.sort((a, b) => b.openedAt - a.openedAt).slice(MAX_ITEMS)
  if (extras.length > 0) {
    const cleanup = db.transaction([META, BLOBS], 'readwrite')
    for (const extra of extras) {
      cleanup.objectStore(META).delete(extra.id)
      cleanup.objectStore(BLOBS).delete(extra.id)
    }
    await new Promise<void>((resolve) => {
      cleanup.oncomplete = () => resolve()
      cleanup.onerror = () => resolve()
    })
  }
  db.close()
}

export async function loadRecent(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb()
  const data = await requestToPromise(
    db.transaction(BLOBS).objectStore(BLOBS).get(id) as IDBRequest<ArrayBuffer | undefined>,
  )
  db.close()
  return data ?? null
}

export async function forgetRecent(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([META, BLOBS], 'readwrite')
  tx.objectStore(META).delete(id)
  tx.objectStore(BLOBS).delete(id)
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}
