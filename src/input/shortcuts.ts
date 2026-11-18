/** Keyboard shortcuts for the viewer chrome. Drawing commands keep the keys while a prompt is active. */

export type ShortcutAction =
  | 'open'
  | 'samples'
  | 'recent'
  | 'snap'
  | 'pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-extents'
  | 'distance'
  | 'area'
  | 'angle'
  | 'arc'
  | 'clear'
  | 'png'
  | 'pdf'
  | 'help'
  | 'escape'

export interface ShortcutEvent {
  key: string
  code?: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  repeat?: boolean
  composing?: boolean
  /** Form field, or the viewer command line once it already has text. */
  typing?: boolean
  /** Viewer is waiting for a point, keyword, or other command input. */
  commandActive?: boolean
}

export interface ShortcutHint {
  action: ShortcutAction | 'snap-suspend'
  labelKey: string
  keys: readonly string[]
}

/** Order is the order shown in the shortcuts dialog. */
export const SHORTCUT_HINTS: readonly ShortcutHint[] = [
  { action: 'open', labelKey: 'toolbar.open', keys: ['Mod', 'O'] },
  { action: 'samples', labelKey: 'toolbar.samples', keys: ['S'] },
  { action: 'recent', labelKey: 'toolbar.recent', keys: ['R'] },
  { action: 'zoom-extents', labelKey: 'toolbar.zoomExtents', keys: ['F'] },
  { action: 'zoom-in', labelKey: 'toolbar.zoomIn', keys: ['+'] },
  { action: 'zoom-out', labelKey: 'toolbar.zoomOut', keys: ['−'] },
  { action: 'pan', labelKey: 'toolbar.pan', keys: ['P'] },
  { action: 'distance', labelKey: 'toolbar.distance', keys: ['D'] },
  { action: 'area', labelKey: 'toolbar.area', keys: ['A'] },
  { action: 'angle', labelKey: 'toolbar.angle', keys: ['N'] },
  { action: 'arc', labelKey: 'toolbar.arc', keys: ['L'] },
  { action: 'clear', labelKey: 'toolbar.clear', keys: ['Shift', 'C'] },
  { action: 'png', labelKey: 'shortcuts.png', keys: ['Mod', 'E'] },
  { action: 'pdf', labelKey: 'shortcuts.pdf', keys: ['Mod', 'Shift', 'E'] },
  { action: 'snap', labelKey: 'toolbar.snap', keys: ['F3'] },
  { action: 'snap-suspend', labelKey: 'shortcuts.suspend', keys: ['Shift'] },
  { action: 'help', labelKey: 'toolbar.shortcuts', keys: ['?'] },
  { action: 'escape', labelKey: 'shortcuts.cancel', keys: ['Esc'] },
]

const LIVE_DURING_COMMAND = new Set<ShortcutAction>(['snap', 'escape', 'zoom-in', 'zoom-out', 'zoom-extents'])
const REPEATABLE = new Set<ShortcutAction>(['zoom-in', 'zoom-out'])

interface TypingNode {
  tagName?: string
  isContentEditable?: boolean
  classList?: { contains?: (name: string) => boolean }
  closest?: (selector: string) => TypingNode | null
  value?: string
  textContent?: string | null
}

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]'

function asNode(target: unknown): TypingNode | null {
  if (!target || typeof target !== 'object') return null
  return target as TypingNode
}

function isCommandLine(field: TypingNode): boolean {
  if (field.classList?.contains?.('ml-cli-text')) return true
  return Boolean(field.closest?.('.ml-cli-container'))
}

function fieldText(field: TypingNode): string {
  if (typeof field.value === 'string') return field.value
  return field.textContent ?? ''
}

/** True when the key should be left for an input. An empty command line still takes shortcuts. */
export function isTypingTarget(target: unknown): boolean {
  const node = asNode(target)
  if (!node) return false
  const tag = node.tagName?.toUpperCase()
  const ownField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(node.isContentEditable)
  const field = ownField ? node : (node.closest?.(FIELD_SELECTOR) ?? null)
  if (!field) return false
  if (isCommandLine(field)) return fieldText(field).trim().length > 0
  return true
}

export function formatChord(keys: readonly string[], mac: boolean): string {
  const parts = keys.map((part) => {
    if (part === 'Mod') return mac ? '⌘' : 'Ctrl'
    if (part === 'Shift') return mac ? '⇧' : 'Shift'
    return part
  })
  return mac ? parts.join('') : parts.join('+')
}

function letter(event: ShortcutEvent, code: string, key: string): boolean {
  if (event.code) return event.code === code
  return event.key === key || event.key === key.toUpperCase()
}

function zoomIn(event: ShortcutEvent): boolean {
  return event.key === '+' || event.key === '=' || event.code === 'NumpadAdd' || event.code === 'Equal'
}

function zoomOut(event: ShortcutEvent): boolean {
  return event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract' || event.code === 'Minus'
}

function helpKey(event: ShortcutEvent): boolean {
  if (event.key === '?') return true
  if (event.code) return event.code === 'Slash' && Boolean(event.shiftKey)
  return Boolean(event.shiftKey) && event.key === '/'
}

export function matchShortcut(event: ShortcutEvent): ShortcutAction | null {
  if (event.typing || event.composing || event.altKey) return null
  const ctrl = Boolean(event.ctrlKey || event.metaKey)
  const shift = Boolean(event.shiftKey)
  let action: ShortcutAction | null = null

  if (ctrl) {
    if (letter(event, 'KeyO', 'o') && !shift) action = 'open'
    else if (letter(event, 'KeyE', 'e') && shift) action = 'pdf'
    else if (letter(event, 'KeyE', 'e')) action = 'png'
  } else if (event.key === 'F3' || event.code === 'F3') {
    action = 'snap'
  } else if (event.key === 'Escape' || event.code === 'Escape') {
    action = 'escape'
  } else if (helpKey(event)) {
    action = 'help'
  } else if (zoomIn(event)) {
    action = 'zoom-in'
  } else if (zoomOut(event)) {
    action = 'zoom-out'
  } else if (shift && letter(event, 'KeyC', 'c')) {
    action = 'clear'
  } else if (shift) {
    action = null
  } else if (letter(event, 'KeyF', 'f')) {
    action = 'zoom-extents'
  } else if (letter(event, 'KeyP', 'p')) {
    action = 'pan'
  } else if (letter(event, 'KeyD', 'd')) {
    action = 'distance'
  } else if (letter(event, 'KeyA', 'a')) {
    action = 'area'
  } else if (letter(event, 'KeyN', 'n')) {
    action = 'angle'
  } else if (letter(event, 'KeyL', 'l')) {
    action = 'arc'
  } else if (letter(event, 'KeyS', 's')) {
    action = 'samples'
  } else if (letter(event, 'KeyR', 'r')) {
    action = 'recent'
  }

  if (!action) return null
  if (event.repeat && !REPEATABLE.has(action)) return null
  if (event.commandActive && !LIVE_DURING_COMMAND.has(action)) return null
  return action
}
