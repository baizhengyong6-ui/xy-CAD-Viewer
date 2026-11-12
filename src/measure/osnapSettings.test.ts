import { AcDbOsnapMode, acdbHasOsnapMode } from '@mlightcad/data-model'
import { describe, expect, it } from 'vitest'
import { readSnapSettings, snapMask, snapModes } from './osnapSettings'

describe('snap settings', () => {
  it('enables endpoint through quadrant unless snapping is off or Shift is held', () => {
    const settings = readSnapSettings(null)
    const mask = snapMask(settings, false)
    expect(acdbHasOsnapMode(mask, AcDbOsnapMode.EndPoint)).toBe(true)
    expect(acdbHasOsnapMode(mask, AcDbOsnapMode.Nearest)).toBe(true)
    expect(acdbHasOsnapMode(mask, AcDbOsnapMode.Perpendicular)).toBe(true)
    expect(acdbHasOsnapMode(mask, AcDbOsnapMode.Quadrant)).toBe(true)
    expect(snapModes({ ...settings, enabled: false }, false)).toEqual([])
    expect(snapModes(settings, true)).toEqual([])
  })

  it('keeps unknown stored values from turning a mode off', () => {
    const settings = readSnapSettings(JSON.stringify({ enabled: true, kinds: { nearest: false } }))
    expect(settings.kinds.nearest).toBe(false)
    expect(settings.kinds.endpoint).toBe(true)
  })
})
