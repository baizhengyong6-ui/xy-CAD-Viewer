import { describe, expect, it } from 'vitest'
import {
  bulgeArc,
  chooseSnap,
  circleQuadrants,
  lineArcIntersections,
  lineCircleIntersections,
  lineLineIntersection,
  midpoint,
  nearestOnCircle,
  nearestOnSegment,
  perpendicularFoot,
  segmentSegmentIntersection,
  transformBlockPoint,
  worldTolerance,
} from './snap'

describe('object snap geometry', () => {
  it('keeps the aperture in pixels when the zoom changes', () => {
    expect(worldTolerance(10, 2)).toBe(20)
    expect(worldTolerance(10, 0.25)).toBe(2.5)
    expect(worldTolerance(24, 0.5)).toBe(12)
  })

  it('computes endpoint, midpoint, center, and quadrant', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 })
    expect(circleQuadrants({ x: 0, y: 0 }, 4)).toEqual([
      { x: 4, y: 0 },
      { x: 0, y: 4 },
      { x: -4, y: 0 },
      { x: 0, y: -4 },
    ])
  })

  it('intersects lines and segments', () => {
    expect(lineLineIntersection({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toEqual({
      x: 1,
      y: 1,
    })
    expect(lineLineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull()
    expect(
      segmentSegmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 }),
    ).toBeNull()
  })

  it('intersects a line with a circle and an arc', () => {
    const hits = lineCircleIntersections({ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }, 1)
    expect(hits).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ])
    const onArc = lineArcIntersections(
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 0 },
      1,
      -Math.PI / 2,
      Math.PI / 2,
    )
    expect(onArc).toEqual([{ x: 1, y: 0 }])
  })

  it('finds the nearest point and the perpendicular foot', () => {
    expect(nearestOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 })
    expect(nearestOnSegment({ x: 12, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 })
    expect(perpendicularFoot({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 })
    expect(nearestOnCircle({ x: 3, y: 0 }, { x: 0, y: 0 }, 1)).toEqual({ x: 1, y: 0 })
  })

  it('turns a bulge of 1 into a semicircle and transforms a block child', () => {
    const arc = bulgeArc({ x: 0, y: 0 }, { x: 2, y: 0 }, 1)
    expect(arc?.center).toEqual({ x: 1, y: 0 })
    expect(arc?.radius).toBeCloseTo(1)
    expect(arc?.midpoint.x).toBeCloseTo(1)
    expect(arc?.midpoint.y).toBeCloseTo(1)
    const turned = transformBlockPoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2)
    expect(turned.x).toBeCloseTo(0)
    expect(turned.y).toBeCloseTo(1)
  })

  it('prefers an endpoint inside the tolerance over a nearer nearest-point', () => {
    const chosen = chooseSnap({ x: 0.2, y: 0.2 }, [
      { kind: 'nearest', point: { x: 0.1, y: 0 } },
      { kind: 'endpoint', point: { x: 0, y: 0 } },
    ], 1)
    expect(chosen?.kind).toBe('endpoint')
  })
})
