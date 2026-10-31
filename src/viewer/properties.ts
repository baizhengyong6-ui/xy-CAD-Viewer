import {
  arcLengthFromAngles,
  distance,
  formatNumber,
  polygonArea,
  polygonPerimeter,
  type Point2,
} from '../measure/math'

export interface PropertyRow {
  key: string
  value: string
}

interface PointLike {
  x: number
  y: number
}

function asPoint(value: unknown): PointLike | null {
  if (!value || typeof value !== 'object') return null
  const point = value as { x?: unknown; y?: unknown }
  if (typeof point.x !== 'number' || typeof point.y !== 'number') return null
  return { x: point.x, y: point.y }
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\\P/g, ' ').trim()
  return ''
}

interface PolylineLike {
  numberOfVertices?: number
  closed?: boolean
  getPoint2dAt?: (index: number) => PointLike
}

export function describeEntity(
  entity: object,
  formatLength: (value: number) => string,
  formatArea: (value: number) => string,
): PropertyRow[] {
  const record = entity as {
    dxfTypeName?: string
    layer?: string
    textString?: string
    contents?: string
    radius?: number
    startAngle?: number
    endAngle?: number
    startPoint?: unknown
    endPoint?: unknown
  }
  const rows: PropertyRow[] = []
  const rawType = record.dxfTypeName ?? entity.constructor.name
  const typeName = rawType.replace(/^AcDb/i, '').toUpperCase()
  rows.push({ key: 'type', value: typeName })
  if (typeof record.layer === 'string' && record.layer) {
    rows.push({ key: 'layer', value: record.layer })
  }

  const start = asPoint(record.startPoint)
  const end = asPoint(record.endPoint)
  if (start && end) {
    rows.push({ key: 'length', value: formatLength(distance(start, end)) })
  }

  if (typeof record.radius === 'number') {
    rows.push({ key: 'radius', value: formatLength(record.radius) })
    if (typeof record.startAngle === 'number' && typeof record.endAngle === 'number') {
      rows.push({
        key: 'length',
        value: formatLength(arcLengthFromAngles(record.radius, record.startAngle, record.endAngle)),
      })
    } else if (!start) {
      rows.push({ key: 'length', value: formatLength(2 * Math.PI * record.radius) })
    }
  }

  const poly = entity as PolylineLike
  if (typeof poly.numberOfVertices === 'number' && poly.getPoint2dAt) {
    const points: Point2[] = []
    for (let i = 0; i < poly.numberOfVertices; i += 1) {
      const point = poly.getPoint2dAt(i)
      if (point) points.push({ x: point.x, y: point.y })
    }
    rows.push({ key: 'vertices', value: formatNumber(points.length, 0) })
    rows.push({ key: 'closed', value: poly.closed ? 'yes' : 'no' })
    if (points.length >= 2) {
      rows.push({
        key: 'length',
        value: formatLength(polygonPerimeter(points, Boolean(poly.closed))),
      })
    }
    if (poly.closed && points.length >= 3) {
      rows.push({ key: 'area', value: formatArea(polygonArea(points)) })
    }
  }

  const text = textOf(record.textString) || textOf(record.contents)
  if (text) rows.push({ key: 'text', value: text })
  return rows
}
