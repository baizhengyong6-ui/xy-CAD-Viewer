/** Screen-pixel aperture. World size changes with zoom; the pixel radius does not. */
export const DESKTOP_SNAP_PX = 10
export const TOUCH_SNAP_PX = 24

export interface Vec2 {
  x: number
  y: number
}

export type SnapKind =
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'quadrant'
  | 'intersection'
  | 'perpendicular'
  | 'nearest'

export interface SnapCandidate {
  point: Vec2
  kind: SnapKind
}

const KIND_RANK: Record<SnapKind, number> = {
  endpoint: 0,
  midpoint: 1,
  center: 2,
  intersection: 3,
  quadrant: 4,
  perpendicular: 5,
  nearest: 6,
}

export function worldTolerance(hitRadiusPx: number, worldPerPixel: number): number {
  return hitRadiusPx * Math.abs(worldPerPixel)
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function segmentEndpoints(a: Vec2, b: Vec2): Vec2[] {
  return [a, b]
}

export function circleCenter(center: Vec2): Vec2 {
  return { x: center.x, y: center.y }
}

export function circleQuadrants(center: Vec2, radius: number): Vec2[] {
  return [
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y },
    { x: center.x, y: center.y - radius },
  ]
}

export function ellipseQuadrants(center: Vec2, rx: number, ry: number): Vec2[] {
  return [
    { x: center.x + rx, y: center.y },
    { x: center.x, y: center.y + ry },
    { x: center.x - rx, y: center.y },
    { x: center.x, y: center.y - ry },
  ]
}

/** Infinite-line intersection. Null when the lines are parallel. */
export function lineLineIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const dax = a2.x - a1.x
  const day = a2.y - a1.y
  const dbx = b2.x - b1.x
  const dby = b2.y - b1.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-12) return null
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom
  return { x: a1.x + t * dax, y: a1.y + t * day }
}

/** Intersection that also lies on both segments. */
export function segmentSegmentIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const dax = a2.x - a1.x
  const day = a2.y - a1.y
  const dbx = b2.x - b1.x
  const dby = b2.y - b1.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-12) return null
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null
  return { x: a1.x + t * dax, y: a1.y + t * day }
}

export function lineCircleIntersections(a: Vec2, b: Vec2, center: Vec2, radius: number): Vec2[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fx = a.x - center.x
  const fy = a.y - center.y
  const aa = dx * dx + dy * dy
  if (aa < 1e-12) return []
  const bb = 2 * (fx * dx + fy * dy)
  const cc = fx * fx + fy * fy - radius * radius
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return []
  const root = Math.sqrt(disc)
  const hits: Vec2[] = []
  for (const t of [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)]) {
    if (Math.abs(disc) < 1e-10 && hits.length > 0) break
    hits.push({ x: a.x + t * dx, y: a.y + t * dy })
  }
  return hits
}

function normalizeAngle(angle: number): number {
  const tau = Math.PI * 2
  let value = angle % tau
  if (value < 0) value += tau
  return value
}

/** True when `angle` lies on the CCW sweep from `start` to `end`. */
export function angleOnArc(angle: number, start: number, end: number): boolean {
  const sweep = normalizeAngle(end - start)
  const fromStart = normalizeAngle(angle - start)
  if (sweep < 1e-9) return fromStart < 1e-9 || Math.abs(fromStart - Math.PI * 2) < 1e-9
  return fromStart <= sweep + 1e-9
}

export function lineArcIntersections(
  a: Vec2,
  b: Vec2,
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
): Vec2[] {
  return lineCircleIntersections(a, b, center, radius).filter((point) =>
    angleOnArc(Math.atan2(point.y - center.y, point.x - center.x), startAngle, endAngle),
  )
}

export function nearestOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return { x: a.x, y: a.y }
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

export function perpendicularFoot(point: Vec2, a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return null
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2
  return { x: a.x + t * dx, y: a.y + t * dy }
}

export function nearestOnCircle(point: Vec2, center: Vec2, radius: number): Vec2 {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-12) return { x: center.x + radius, y: center.y }
  return { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius }
}

/**
 * Closest point on an axis-aligned ellipse. Samples the parameter; accurate
 * enough for a snap candidate, not a CAD solver.
 */
export function nearestOnEllipse(point: Vec2, center: Vec2, rx: number, ry: number): Vec2 {
  let best = { x: center.x + rx, y: center.y }
  let bestDist = Infinity
  const steps = 64
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2
    const candidate = { x: center.x + Math.cos(t) * rx, y: center.y + Math.sin(t) * ry }
    const d = distance(point, candidate)
    if (d < bestDist) {
      best = candidate
      bestDist = d
    }
  }
  return best
}

/**
 * DXF bulge arc between two vertices. Positive bulge is counter-clockwise.
 * A bulge of 1 is a semicircle.
 */
export function bulgeArc(start: Vec2, end: Vec2, bulge: number): { center: Vec2; radius: number; midpoint: Vec2 } | null {
  if (Math.abs(bulge) < 1e-12) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  const chord = Math.hypot(dx, dy)
  if (chord < 1e-12) return null
  const theta = 4 * Math.atan(bulge)
  const radius = Math.abs(chord / (2 * Math.sin(theta / 2)))
  const mid = midpoint(start, end)
  const nx = -dy / chord
  const ny = dx / chord
  const offset = Math.sqrt(Math.max(radius * radius - (chord / 2) * (chord / 2), 0))
  const sign = bulge > 0 ? 1 : -1
  const center = { x: mid.x + sign * nx * offset, y: mid.y + sign * ny * offset }
  const arcMid = { x: center.x + sign * nx * radius, y: center.y + sign * ny * radius }
  return { center, radius, midpoint: arcMid }
}

/** Rotate `point` around `origin` by `radians` and scale from the origin. */
export function transformBlockPoint(point: Vec2, origin: Vec2, radians: number, scale = 1): Vec2 {
  const dx = (point.x - origin.x) * scale
  const dy = (point.y - origin.y) * scale
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export function chooseSnap(cursor: Vec2, candidates: readonly SnapCandidate[], tolerance: number): SnapCandidate | null {
  let best: SnapCandidate | null = null
  let bestRank = Infinity
  let bestDist = Infinity
  for (const candidate of candidates) {
    const d = distance(cursor, candidate.point)
    if (d > tolerance) continue
    const rank = KIND_RANK[candidate.kind]
    if (rank < bestRank || (rank === bestRank && d < bestDist)) {
      best = candidate
      bestRank = rank
      bestDist = d
    }
  }
  return best
}
