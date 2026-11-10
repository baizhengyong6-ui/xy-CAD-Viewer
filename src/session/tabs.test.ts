import { describe, expect, it } from 'vitest'
import {
  canOpenAnotherTab,
  findTabByName,
  formatOpenedAt,
  MOBILE_TAB_LIMIT,
  nextActiveAfterClose,
  type TabModel,
} from './tabs'

const tabs: TabModel[] = [
  { id: 'a', name: 'Plan.dxf' },
  { id: 'b', name: 'site.dwg' },
  { id: 'c', name: 'detail.dxf' },
]

describe('drawing tabs', () => {
  it('finds an already-open file without caring about case', () => {
    expect(findTabByName(tabs, 'plan.dxf')?.id).toBe('a')
    expect(findTabByName(tabs, ' missing.dxf ')).toBeUndefined()
  })

  it('allows focusing an open file after the mobile cap is full', () => {
    expect(canOpenAnotherTab(MOBILE_TAB_LIMIT, true, false)).toBe(false)
    expect(canOpenAnotherTab(MOBILE_TAB_LIMIT, true, true)).toBe(true)
    expect(canOpenAnotherTab(MOBILE_TAB_LIMIT, false, false)).toBe(true)
  })

  it('selects the neighbor when the active tab closes and keeps the others', () => {
    expect(nextActiveAfterClose(tabs, 'b', 'b')).toBe('c')
    expect(nextActiveAfterClose(tabs, 'c', 'c')).toBe('b')
    expect(nextActiveAfterClose(tabs, 'a', 'c')).toBe('c')
    expect(nextActiveAfterClose([{ id: 'a', name: 'only.dxf' }], 'a', 'a')).toBe('')
  })

  it('shows a clock time for today and a date for older files', () => {
    const now = new Date(2026, 10, 10, 15, 4).getTime()
    expect(formatOpenedAt(new Date(2026, 10, 10, 9, 5).getTime(), now)).toBe('09:05')
    expect(formatOpenedAt(new Date(2026, 10, 9, 18, 30).getTime(), now)).toBe('11/9 18:30')
  })
})
