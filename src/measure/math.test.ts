import { describe, expect, it } from 'vitest'
import {
  applyScale,
  arcLengthFromAngles,
  arcLengthFromPoints,
  convertArea,
  convertLength,
  distance,
  formatNumber,
  interiorAngle,
  normalizeSweep,
  polygonArea,
  polygonPerimeter,
  unitSymbol,
} from './math'

describe('measurement math', () => {
  it('measures straight distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(100)
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('measures polygon area and perimeter', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]
    expect(polygonArea(triangle)).toBe(2500)
    expect(polygonPerimeter(triangle)).toBeCloseTo(100 + 50 + Math.hypot(100, 50))
    expect(polygonArea([])).toBe(0)
  })

  it('measures the interior angle at the vertex', () => {
    const right = interiorAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 2 })
    expect(right).toBeCloseTo(Math.PI / 2)
    const flat = interiorAngle({ x: -2, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(flat).toBeCloseTo(Math.PI)
    expect(interiorAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN()
  })

  it('measures counter-clockwise arc length from angles', () => {
    expect(arcLengthFromAngles(10, 0, Math.PI / 2)).toBeCloseTo((Math.PI * 10) / 2)
    expect(arcLengthFromAngles(10, Math.PI / 2, 0)).toBeCloseTo((Math.PI * 10 * 3) / 2)
  })

  it('keeps the sweep that passes through the third point', () => {
    const center = { x: 0, y: 0 }
    const start = { x: 10, y: 0 }
    const end = { x: 0, y: 10 }
    const minor = arcLengthFromPoints(center, 10, start, end)
    expect(minor).toBeCloseTo((Math.PI * 10) / 2)
    const major = arcLengthFromPoints(center, 10, start, end, { x: 0, y: -10 })
    expect(major).toBeCloseTo((Math.PI * 10 * 3) / 2)
  })

  it('converts length and area between INSUNITS', () => {
    expect(convertLength(1000, 4, 6)).toBeCloseTo(1)
    expect(convertLength(1, 1, 4)).toBeCloseTo(25.4)
    expect(convertArea(1_000_000, 4, 6)).toBeCloseTo(1)
    expect(convertLength(12, 0, 4)).toBe(12)
    expect(convertLength(12, 4, 4)).toBe(12)
  })

  it('applies a drawing scale after unit conversion', () => {
    const metres = convertLength(5000, 4, 6)
    expect(applyScale(metres, 1)).toBeCloseTo(5)
    expect(applyScale(convertLength(10, 4, 4), 100)).toBeCloseTo(1000)
  })

  it('treats clockwise and counter-clockwise polygons as the same area', () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const cw = [...ccw].reverse()
    expect(polygonArea(ccw)).toBe(100)
    expect(polygonArea(cw)).toBe(100)
    expect(polygonArea(ccw.slice(0, 2))).toBe(0)
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 9, y: 0 },
      ]),
    ).toBe(0)
  })

  it('omits the closing edge of an open polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]
    expect(polygonPerimeter(points, false)).toBe(150)
    expect(polygonPerimeter(points, true)).toBeCloseTo(150 + Math.hypot(100, 50))
    expect(polygonPerimeter([{ x: 0, y: 0 }])).toBe(0)
    expect(polygonPerimeter([])).toBe(0)
  })

  it('measures the smaller angle and rejects a zero-length arm', () => {
    expect(interiorAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.PI / 4)
    expect(interiorAngle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(Math.PI / 4)
    expect(interiorAngle({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 })).toBeCloseTo(0)
  })

  it('wraps an angle sweep into one counter-clockwise turn', () => {
    expect(normalizeSweep(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(normalizeSweep(Math.PI / 2, 0)).toBeCloseTo((Math.PI * 3) / 2)
    expect(normalizeSweep(0, Math.PI * 2)).toBeCloseTo(0)
    expect(normalizeSweep(0.2, 0.2 - Math.PI * 4)).toBeCloseTo(0)
    expect(arcLengthFromAngles(-10, 0, Math.PI)).toBeCloseTo(Math.PI * 10)
  })

  it('uses the minor arc unless a through-point selects the other sweep', () => {
    const center = { x: 1, y: 1 }
    const start = { x: 11, y: 1 }
    const end = { x: 1, y: 11 }
    expect(arcLengthFromPoints(center, 0, start, end)).toBeCloseTo((Math.PI * 10) / 2)
    const full = arcLengthFromPoints(center, 10, start, start, { x: 1, y: -9 })
    expect(full).toBeCloseTo(Math.PI * 20)
    expect(arcLengthFromPoints(center, 10, start, start)).toBeCloseTo(0)
  })

  it('converts the units offered in the measurement panel', () => {
    expect(convertLength(1, 5, 4)).toBeCloseTo(10)
    expect(convertLength(1, 2, 1)).toBeCloseTo(12)
    expect(convertLength(1, 7, 6)).toBeCloseTo(1000)
    expect(convertLength(-2000, 4, 6)).toBeCloseTo(-2)
    expect(convertArea(1, 6, 5)).toBeCloseTo(10_000)
    expect(convertArea(1, 2, 1)).toBeCloseTo(144)
    expect(convertLength(12, 99, 4)).toBe(12)
    expect(convertLength(12, 4, -1)).toBe(12)
    expect(convertArea(Number.NaN, 4, 6)).toBeNaN()
    expect(convertLength(Number.POSITIVE_INFINITY, 4, 6)).toBe(Number.POSITIVE_INFINITY)
  })

  it('rejects a scale that is not a finite number', () => {
    expect(applyScale(Number.NaN, 100)).toBeNaN()
    expect(applyScale(10, Number.POSITIVE_INFINITY)).toBeNaN()
    expect(applyScale(10, 0)).toBe(0)
  })

  it('formats a number to the selected decimals and names INSUNITS', () => {
    expect(formatNumber(1.239, 2)).toBe('1.24')
    expect(formatNumber(Math.PI, 0)).toBe('3')
    expect(formatNumber(1.5, 8)).toBe('1.50000000')
    expect(formatNumber(1.5, 12)).toBe('1.50000000')
    expect(formatNumber(1.5, -3)).toBe('2')
    expect(formatNumber(Number.NaN, 2)).toBe('—')
    expect(formatNumber(Number.NEGATIVE_INFINITY, 2)).toBe('—')
    expect(unitSymbol(4)).toBe('mm')
    expect(unitSymbol(1)).toBe('in')
    expect(unitSymbol(2)).toBe('ft')
    expect(unitSymbol(6)).toBe('m')
    expect(unitSymbol(0)).toBe('')
    expect(unitSymbol(99)).toBe('')
  })
})
