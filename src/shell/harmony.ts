/**
 * HarmonyOS ArkWeb calls this after the user picks a file or another app
 * hands one over. The bytes stay on the native side and are fetched through
 * the https://xinyao.local scheme handler, so a large drawing is not stuffed
 * into a JavaScript string.
 */
type InboxOpener = (id: string, name: string) => Promise<void>

const waiting: Array<{ id: string; name: string }> = []
let opener: InboxOpener | null = null

async function fetchInbox(id: string, name: string): Promise<void> {
  const response = await fetch(`https://xinyao.local/inbox/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(`inbox ${response.status}`)
  const data = await response.arrayBuffer()
  await window.openCadFile(name, data)
}

window.__xinyaoOpenInbox = (id: string, name: string) => {
  if (!opener) {
    waiting.push({ id, name })
    return
  }
  void opener(id, name)
}

export function startHarmonyInbox(open: InboxOpener): void {
  opener = open
  const queued = waiting.splice(0, waiting.length)
  for (const item of queued) void open(item.id, item.name)
}

export function harmonyInboxOpener(): InboxOpener {
  return fetchInbox
}
