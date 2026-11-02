/** Phone and tablet WebViews run out of memory well before the desktop 512 MB cap. */
export const MOBILE_DRAWING_LIMIT_BYTES = 96 * 1024 * 1024

export function formatByteSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isMemoryFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /out of memory|allocation failed|array buffer allocation|RangeError|OOM/i.test(text)
}
