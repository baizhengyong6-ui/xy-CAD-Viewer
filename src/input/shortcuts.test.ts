import { describe, expect, it } from 'vitest'
import { formatChord, isTypingTarget, matchShortcut, SHORTCUT_HINTS, type ShortcutAction, type ShortcutEvent } from './shortcuts'

function press(partial: ShortcutEvent): ShortcutAction | null {
  return matchShortcut(partial)
}

describe('keyboard shortcuts', () => {
  it('maps the viewer keys', () => {
    expect(press({ key: 'd' })).toBe('distance')
    expect(press({ key: 'A' })).toBe('area')
    expect(press({ key: 'n' })).toBe('angle')
    expect(press({ key: 'l' })).toBe('arc')
    expect(press({ key: 'p' })).toBe('pan')
    expect(press({ key: 'f' })).toBe('zoom-extents')
    expect(press({ key: 's' })).toBe('samples')
    expect(press({ key: 'r' })).toBe('recent')
    expect(press({ key: '+', shiftKey: true })).toBe('zoom-in')
    expect(press({ key: '=' })).toBe('zoom-in')
    expect(press({ key: '-' })).toBe('zoom-out')
    expect(press({ key: '_', shiftKey: true, code: 'Minus' })).toBe('zoom-out')
    expect(press({ key: 'F3' })).toBe('snap')
    expect(press({ key: 'Escape' })).toBe('escape')
    expect(press({ key: '?' , shiftKey: true })).toBe('help')
    expect(press({ key: '/', shiftKey: true })).toBe('help')
    expect(press({ key: 'C', shiftKey: true })).toBe('clear')
    expect(press({ key: 'o', ctrlKey: true })).toBe('open')
    expect(press({ key: 'o', metaKey: true })).toBe('open')
    expect(press({ key: 'e', ctrlKey: true })).toBe('png')
    expect(press({ key: 'E', metaKey: true, shiftKey: true })).toBe('pdf')
  })

  it('uses the physical key when a code is present', () => {
    expect(press({ key: 'д', code: 'KeyD' })).toBe('distance')
    expect(press({ key: 'o', code: 'KeyO', ctrlKey: true })).toBe('open')
    expect(press({ key: 'Process', code: 'KeyD', composing: true })).toBeNull()
  })

  it('leaves typing, chords, and an active command alone', () => {
    expect(press({ key: 'd', typing: true })).toBeNull()
    expect(press({ key: 'd', altKey: true })).toBeNull()
    expect(press({ key: 'd', ctrlKey: true })).toBeNull()
    expect(press({ key: 'd', shiftKey: true })).toBeNull()
    expect(press({ key: 'd', repeat: true })).toBeNull()
    expect(press({ key: '+', repeat: true })).toBe('zoom-in')
    expect(press({ key: 'd', commandActive: true })).toBeNull()
    expect(press({ key: 'f', commandActive: true })).toBe('zoom-extents')
    expect(press({ key: '-', commandActive: true })).toBe('zoom-out')
    expect(press({ key: 'F3', commandActive: true })).toBe('snap')
    expect(press({ key: 'Escape', commandActive: true })).toBe('escape')
    expect(press({ key: 'p', metaKey: true })).toBeNull()
  })

  it('treats an empty command line as free and other fields as typing', () => {
    const commandLine = {
      tagName: 'INPUT',
      classList: { contains: (name: string) => name === 'ml-cli-text' },
      value: '',
    }
    expect(isTypingTarget(commandLine)).toBe(false)
    expect(isTypingTarget({ ...commandLine, value: 'zoom' })).toBe(true)
    expect(isTypingTarget({ tagName: 'INPUT', value: '' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('lists every shortcut the matcher can return', () => {
    const hinted = new Set(SHORTCUT_HINTS.map((hint) => hint.action))
    const actions: ShortcutAction[] = [
      'open',
      'samples',
      'recent',
      'snap',
      'pan',
      'zoom-in',
      'zoom-out',
      'zoom-extents',
      'distance',
      'area',
      'angle',
      'arc',
      'clear',
      'png',
      'pdf',
      'help',
      'escape',
    ]
    for (const action of actions) expect(hinted.has(action)).toBe(true)
    expect(formatChord(['Mod', 'Shift', 'E'], false)).toBe('Ctrl+Shift+E')
    expect(formatChord(['Mod', 'O'], true)).toBe('⌘O')
    expect(formatChord(['Shift', 'C'], true)).toBe('⇧C')
    expect(formatChord(['+'], false)).toBe('+')
  })
})
