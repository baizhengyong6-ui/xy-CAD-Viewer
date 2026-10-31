/** Pure measurement math. Drawing units stay unitless until conversion. */

export interface Point2 {
  x: number
  y: number
}

/** Metres per one drawing unit, keyed by AutoCAD INSUNITS. */
const METERS_PER_UNIT: Record<number, number> = {
  1: 0.0254,
  2: 0.3048,
  3: 1609.344,
  4: 0.001,
  5: 0.01,
  6: 1,
  7: 1000,
  8: 2.54e-8,
  9: 2.54e-5,
  10: 0.9144,
  11: 1e-10,
  12: 1e-9,
  13: 1e-6,
  14: 0.1,
  15: 10,
  16: 100,
  17: 1e9,
  18: 1.495978707e11,
  19: 9.4607304725808e15,
  20: 3.0856775814913673e16,
  21: 1200 / 3937,
}

export const UNIT_SYMBOLS: Record<number, string> = {
  0: '',
  1: 'in',
  2: 'ft',
  3: 'mi',
  4: 'mm',
  5: 'cm',
  6: 'm',
  7: 'km',
  8: 'µin',
  9: 'mil',
  10: 'yd',
  14: 'dm',
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Absolute shoelace area. The polygon is closed implicitly. */
export function polygonArea(points: readonly Point2[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (!a || !b) continue
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function polygonPerimeter(points: readonly Point2[], closed = true): number {
  if (points.length < 2) return 0
  let length = 0
  const last = closed ? points.length : points.length - 1
  for (let i = 0; i < last; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (!a || !b) continue
    length += distance(a, b)
  }
  return length
}

/** Interior angle at `vertex`, radians in [0, π]. */
export function interiorAngle(arm1: Point2, vertex: Point2, arm2: Point2): number {
  const v1x = arm1.x - vertex.x
  const v1y = arm1.y - vertex.y
  const v2x = arm2.x - vertex.x
  const v2y = arm2.y - vertex.y
  const n1 = Math.hypot(v1x, v1y)
  const n2 = Math.hypot(v2x, v2y)
  if (n1 === 0 || n2 === 0) return Number.NaN
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (n1 * n2)))
  return Math.acos(cos)
}

const TAU = Math.PI * 2

export function normalizeSweep(startAngle: number, endAngle: number): number {
  let sweep = endAngle - startAngle
  sweep = ((sweep % TAU) + TAU) % TAU
  return sweep
}

/** Counter-clockwise arc length. AutoCAD arcs run from start angle to end angle CCW. */
export function arcLengthFromAngles(radius: number, startAngle: number, endAngle: number): number {
  return Math.abs(radius) * normalizeSweep(startAngle, endAngle)
}

function angleAt(center: Point2, point: Point2): number {
  return Math.atan2(point.y - center.y, point.x - center.x)
}

/**
 * Arc length along the sweep that contains `through` when provided.
 * Without `through`, the minor arc is used.
 */
export function arcLengthFromPoints(
  center: Point2,
  radius: number,
  start: Point2,
  end: Point2,
  through?: Point2,
): number {
  const r = Math.abs(radius) || distance(center, start)
  const a0 = angleAt(center, start)
  const a1 = angleAt(center, end)
  const ccw = normalizeSweep(a0, a1)
  if (!through) {
    const minor = Math.min(ccw, TAU - ccw)
    return r * minor
  }
  const at = angleAt(center, through)
  const contains = normalizeSweep(a0, at) <= ccw + 1e-9
  const sweep = contains ? ccw : TAU - ccw
  return r * sweep
}

export function convertLength(value: number, fromUnit: number, toUnit: number): number {
  if (!Number.isFinite(value)) return value
  if (fromUnit === toUnit || fromUnit <= 0 || toUnit <= 0) return value
  const from = METERS_PER_UNIT[fromUnit]
  const to = METERS_PER_UNIT[toUnit]
  if (from === undefined || to === undefined) return value
  return (value * from) / to
}

export function convertArea(value: number, fromUnit: number, toUnit: number): number {
  if (!Number.isFinite(value)) return value
  if (fromUnit === toUnit || fromUnit <= 0 || toUnit <= 0) return value
  const from = METERS_PER_UNIT[fromUnit]
  const to = METERS_PER_UNIT[toUnit]
  if (from === undefined || to === undefined) return value
  const factor = from / to
  return value * factor * factor
}

/** `scale` is the drawing factor: real = paper × scale. 1:100 → 100. */
export function applyScale(value: number, scale: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(scale)) return Number.NaN
  return value * scale
}

export function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return '—'
  const digits = Math.min(8, Math.max(0, precision))
  return value.toFixed(digits)
}

export function unitSymbol(unit: number): string {
  return UNIT_SYMBOLS[unit] ?? ''
}
