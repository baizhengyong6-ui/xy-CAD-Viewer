/** Resolve a file shipped in `public/` against the current page, including relative builds. */
export function publicUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  return new URL(`${import.meta.env.BASE_URL}${normalized}`, window.location.href).href
}

export function cadDataBaseUrl(): string {
  return publicUrl('cad-data/')
}
