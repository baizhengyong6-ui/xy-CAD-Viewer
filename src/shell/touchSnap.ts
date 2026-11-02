import { AcApSettingManager } from '@mlightcad/cad-simple-viewer'

interface SnapOptions {
  hitRadiusPx?: number
  cursorWcs: { x: number; y: number }
}

interface SnapResolver {
  resolve: (options: SnapOptions) => unknown
  __xinyaoWide?: boolean
}

/** Wider than the library default of 20 CSS pixels, so a fingertip can land on an endpoint. */
const TOUCH_HIT_RADIUS_PX = 36

export function coarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/**
 * Phone and tablet: keep the library's long-press loupe and the crosshair that
 * sits above the finger, and enlarge the object-snap aperture.
 */
export function configureTouchSnap(view: { selectionBoxSize: number; osnapResolver: object } | null | undefined): void {
  if (!view || !coarsePointer()) return
  view.selectionBoxSize = 28
  AcApSettingManager.instance.set('useSimulatedMouseOnTouch', true, { persist: false })
  const resolver = view.osnapResolver as SnapResolver
  if (resolver.__xinyaoWide) return
  const original = resolver.resolve.bind(resolver)
  resolver.resolve = (options) =>
    original({
      ...options,
      hitRadiusPx: Math.max(options.hitRadiusPx ?? 0, TOUCH_HIT_RADIUS_PX),
    })
  resolver.__xinyaoWide = true
}
