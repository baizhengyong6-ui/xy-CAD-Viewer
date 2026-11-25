import { describe, expect, it } from 'vitest'
import { describeEntity } from './properties'

const length = (value: number) => value.toFixed(2)
const area = (value: number) => value.toFixed(2)

function row(entity: object, key: string): string | undefined {
  return describeEntity(entity, length, area).find((item) => item.key === key)?.value
}

function rows(entity: object, key: string): string[] {
  return describeEntity(entity, length, area).filter((item) => item.key === key).map((item) => item.value)
}

describe('entity measurement properties', () => {
  it('measures a line by its endpoints', () => {
    const listed = describeEntity(
      { dxfTypeName: 'AcDbLine', layer: '0', startPoint: { x: 0, y: 0 }, endPoint: { x: 3, y: 4 } },
      length,
      area,
    )
    expect(listed).toEqual([
      { key: 'type', value: 'LINE' },
      { key: 'layer', value: '0' },
      { key: 'length', value: '5.00' },
    ])
  })

  it('uses the circumference when a circle has no chord', () => {
    const entity = { dxfTypeName: 'AcDbCircle', radius: 10 }
    expect(row(entity, 'radius')).toBe('10.00')
    expect(rows(entity, 'length')).toEqual([(2 * Math.PI * 10).toFixed(2)])
  })

  it('lists the chord and the counter-clockwise arc for an arc', () => {
    const entity = {
      dxfTypeName: 'AcDbArc',
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      startPoint: { x: 10, y: 0 },
      endPoint: { x: 0, y: 10 },
    }
    expect(rows(entity, 'length')).toEqual([Math.hypot(10, 10).toFixed(2), ((Math.PI * 10) / 2).toFixed(2)])
  })

  it('measures an open polyline by its segments and a closed one by area too', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]
    const open = {
      dxfTypeName: 'AcDbPolyline',
      numberOfVertices: 3,
      closed: false,
      getPoint2dAt: (index: number) => points[index],
    }
    expect(row(open, 'vertices')).toBe('3')
    expect(row(open, 'closed')).toBe('no')
    expect(row(open, 'length')).toBe((100 + 50).toFixed(2))
    expect(row(open, 'area')).toBeUndefined()

    const closed = { ...open, closed: true }
    expect(row(closed, 'closed')).toBe('yes')
    expect(row(closed, 'length')).toBe((100 + 50 + Math.hypot(100, 50)).toFixed(2))
    expect(row(closed, 'area')).toBe('2500.00')
  })

  it('flattens paragraph breaks in text and skips a missing layer', () => {
    const listed = describeEntity({ dxfTypeName: 'AcDbMText', contents: '一层\\P平面' }, length, area)
    expect(listed).toEqual([
      { key: 'type', value: 'MTEXT' },
      { key: 'text', value: '一层 平面' },
    ])
  })

  it('ignores points that are not numeric', () => {
    const listed = describeEntity(
      { dxfTypeName: 'AcDbLine', startPoint: { x: '0', y: 0 }, endPoint: null },
      length,
      area,
    )
    expect(listed).toEqual([{ key: 'type', value: 'LINE' }])
  })
})
