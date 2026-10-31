import { describe, expect, it } from 'vitest'
import {
  applyScale,
  arcLengthFromAngles,
  arcLengthFromPoints,
  convertArea,
  convertLength,
  distance,
  interiorAngle,
  polygonArea,
  polygonPerimeter,
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
})
