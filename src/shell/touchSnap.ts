import { AcApSettingManager } from '@mlightcad/cad-simple-viewer'
import { DESKTOP_SNAP_PX, TOUCH_SNAP_PX } from '../measure/snap'

interface SnapHit {
  x: number
  y: number
  type: number
}

interface SnapOptions {
  hitRadiusPx?: number
  cursorWcs: { x: number; y: number }
}

interface SnapResolver {
  resolve: (options: SnapOptions) => SnapHit | undefined
  __xinyaoWide?: boolean
}

interface SnapView {
  selectionBoxSize: number
  osnapResolver: object
  worldToScreen?: (point: { x: number; y: number }) => { x: number; y: number }
  container?: HTMLElement
}

const LABELS: Record<number, string> = {
  1: '端点',
  2: '中点',
  3: '圆心',
  5: '象限点',
  6: '交点',
  8: '垂足',
  10: '最近点',
}

export function coarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function snapAperturePx(): number {
  return coarsePointer() ? TOUCH_SNAP_PX : DESKTOP_SNAP_PX
}

let tip: HTMLDivElement | null = null

function snapTip(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  if (!tip) {
    tip = document.createElement('div')
    tip.className = 'snap-tip'
    tip.dataset.testid = 'snap-tip'
    tip.hidden = true
    document.body.appendChild(tip)
  }
  return tip
}

function showSnapTip(view: SnapView, snap: SnapHit | undefined): void {
  const node = snapTip()
  if (!node) return
  const label = snap ? LABELS[snap.type] : ''
  if (!snap || !label || !view.worldToScreen || !view.container) {
    node.hidden = true
    return
  }
  const canvas = view.container.querySelector('canvas')
  if (!canvas) {
    node.hidden = true
    return
  }
  const screen = view.worldToScreen({ x: snap.x, y: snap.y })
  const rect = canvas.getBoundingClientRect()
  node.hidden = false
  node.textContent = label
  node.style.left = `${rect.left + screen.x + 16}px`
  node.style.top = `${rect.top + screen.y - 28}px`
}

/**
 * Forces a zoom-independent pixel aperture and a Chinese snap label.
 * Touch keeps the viewer's loupe and the crosshair above the finger.
 */
export function configureTouchSnap(view: SnapView | null | undefined, snapping: () => boolean): void {
  if (!view) return
  if (coarsePointer()) {
    view.selectionBoxSize = TOUCH_SNAP_PX
    AcApSettingManager.instance.set('useSimulatedMouseOnTouch', true, { persist: false })
  }
  const resolver = view.osnapResolver as SnapResolver
  if (resolver.__xinyaoWide) return
  const original = resolver.resolve.bind(resolver)
  resolver.resolve = (options) => {
    if (!snapping()) {
      showSnapTip(view, undefined)
      return undefined
    }
    const snap = original({
      ...options,
      hitRadiusPx: snapAperturePx(),
    })
    showSnapTip(view, snap)
    return snap
  }
  resolver.__xinyaoWide = true
}
