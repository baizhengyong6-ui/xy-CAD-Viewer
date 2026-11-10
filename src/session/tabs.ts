export interface TabModel {
  id: string
  name: string
}

export const DESKTOP_TAB_LIMIT = 8
export const MOBILE_TAB_LIMIT = 3

export function normalizeDrawingName(name: string): string {
  return name.trim().toLowerCase()
}

export function findTabByName(tabs: readonly TabModel[], name: string): TabModel | undefined {
  const key = normalizeDrawingName(name)
  return tabs.find((tab) => normalizeDrawingName(tab.name) === key)
}

export function tabLimit(mobile: boolean): number {
  return mobile ? MOBILE_TAB_LIMIT : DESKTOP_TAB_LIMIT
}

/** An already-open file may be focused even when the tab cap is full. */
export function canOpenAnotherTab(openCount: number, mobile: boolean, alreadyOpen: boolean): boolean {
  if (alreadyOpen) return true
  return openCount < tabLimit(mobile)
}

/**
 * After closing a tab, keep the current tab when it was not the one closed.
 * Closing the active tab selects the neighbor that occupied the same index,
 * matching the viewer session list.
 */
export function nextActiveAfterClose(tabs: readonly TabModel[], closedId: string, activeId: string): string {
  const index = tabs.findIndex((tab) => tab.id === closedId)
  if (index < 0) return activeId
  const rest = tabs.filter((tab) => tab.id !== closedId)
  if (rest.length === 0) return ''
  if (activeId !== closedId) return activeId
  return rest[Math.min(index, rest.length - 1)]?.id ?? ''
}

export function formatOpenedAt(openedAt: number, now = Date.now()): string {
  const date = new Date(openedAt)
  const today = new Date(now)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  if (sameDay) return time
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
