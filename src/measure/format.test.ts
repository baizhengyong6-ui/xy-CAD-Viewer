import { describe, expect, it } from 'vitest'
import {
  formatAngle,
  formatArea,
  formatLength,
  formatMeasurementCopy,
  formatPoint,
  resolveDisplayUnit,
} from './format'

const mm = { drawingUnit: 4, displayUnit: -1, precision: 2 }

describe('measurement display', () => {
  it('follows the drawing unit when the choice is -1', () => {
    expect(resolveDisplayUnit(-1, 4)).toBe(4)
    expect(resolveDisplayUnit(-1, 0)).toBe(0)
    expect(resolveDisplayUnit(6, 4)).toBe(6)
    expect(resolveDisplayUnit(0, 4)).toBe(0)
  })

  it('formats a length in the drawing unit and after a scale', () => {
    expect(formatLength(1000, mm)).toBe('1000.00 mm')
    expect(formatLength(1000, { ...mm, scale: 1 })).toBe('1000.00 mm')
    expect(formatLength(10, { drawingUnit: 4, displayUnit: 4, precision: 2, scale: 100 })).toBe('1000.00 mm')
    expect(formatLength(1000, { drawingUnit: 4, displayUnit: 6, precision: 3, scale: 1 })).toBe('1.000 m')
    expect(formatLength(1, { drawingUnit: 1, displayUnit: 4, precision: 1 })).toBe('25.4 mm')
    expect(formatLength(1, { drawingUnit: 2, displayUnit: 1, precision: 0, scale: 1 })).toBe('12 in')
  })

  it('leaves a unitless drawing without a symbol', () => {
    expect(formatLength(12.5, { drawingUnit: 0, displayUnit: -1, precision: 2 })).toBe('12.50')
    expect(formatLength(12, { drawingUnit: 0, displayUnit: 0, precision: 0, scale: 10 })).toBe('120')
  })

  it('squares the scale when formatting area', () => {
    expect(formatArea(1_000_000, { drawingUnit: 4, displayUnit: 6, precision: 2 })).toBe('1.00 m²')
    expect(formatArea(1, { drawingUnit: 6, displayUnit: 6, precision: 2, scale: 10 })).toBe('100.00 m²')
    expect(formatArea(1, { drawingUnit: 6, displayUnit: 5, precision: 0 })).toBe('10000 cm²')
    expect(formatArea(2500, { drawingUnit: 4, displayUnit: -1, precision: 2, scale: 1 })).toBe('2500.00 mm²')
  })

  it('formats an angle in degrees and does not invent a unit for a bad value', () => {
    expect(formatAngle(Math.PI / 2, 1)).toBe('90.0°')
    expect(formatAngle(Math.PI, 0)).toBe('180°')
    expect(formatAngle(Number.NaN, 2)).toBe('—°')
  })

  it('formats a picked point with the selected precision', () => {
    expect(formatPoint(1.5, 2, 2)).toBe('1.50, 2.00')
    expect(formatPoint(Number.POSITIVE_INFINITY, 0, 2)).toBe('—, 0.00')
  })

  it('copies one value at 1:1, and both values when a length is scaled', () => {
    const drawing = formatLength(10, { drawingUnit: 4, displayUnit: 4, precision: 2 })
    const scaled = formatLength(10, { drawingUnit: 4, displayUnit: 4, precision: 2, scale: 100 })
    expect(formatMeasurementCopy('距离', 'distance', drawing, '10.00 mm', 1, '图面', '按比例')).toBe(
      '距离  10.00 mm',
    )
    expect(formatMeasurementCopy('距离', 'distance', drawing, scaled, 100, '图面', '按比例')).toBe(
      '距离  图面 10.00 mm  按比例 1:100 1000.00 mm',
    )
    expect(formatMeasurementCopy('角度', 'angle', '90.00°', '90.00°', 100, '图面', '按比例')).toBe('角度  90.00°')
    expect(formatMeasurementCopy('坐标', 'point', '1.00, 2.00', '1.00, 2.00', 50, '图面', '按比例')).toBe(
      '坐标  1.00, 2.00',
    )
  })
})
