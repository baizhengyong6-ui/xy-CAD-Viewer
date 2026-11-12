import { AcDbOsnapMode, acdbOsnapModesToMask } from '@mlightcad/data-model'

export const SNAP_STORAGE_KEY = 'lantu-osnap'

export interface SnapKindFlags {
  endpoint: boolean
  midpoint: boolean
  center: boolean
  intersection: boolean
  nearest: boolean
  perpendicular: boolean
  quadrant: boolean
}

export interface SnapSettings {
  enabled: boolean
  kinds: SnapKindFlags
}

const KIND_MODE: Record<keyof SnapKindFlags, AcDbOsnapMode> = {
  endpoint: AcDbOsnapMode.EndPoint,
  midpoint: AcDbOsnapMode.MidPoint,
  center: AcDbOsnapMode.Center,
  intersection: AcDbOsnapMode.Intersection,
  nearest: AcDbOsnapMode.Nearest,
  perpendicular: AcDbOsnapMode.Perpendicular,
  quadrant: AcDbOsnapMode.Quadrant,
}

export const SNAP_KIND_ORDER: (keyof SnapKindFlags)[] = [
  'endpoint',
  'midpoint',
  'center',
  'intersection',
  'nearest',
  'perpendicular',
  'quadrant',
]

export function defaultSnapSettings(): SnapSettings {
  return {
    enabled: true,
    kinds: {
      endpoint: true,
      midpoint: true,
      center: true,
      intersection: true,
      nearest: true,
      perpendicular: true,
      quadrant: true,
    },
  }
}

export function readSnapSettings(raw: string | null): SnapSettings {
  const fallback = defaultSnapSettings()
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<SnapSettings>
    const kinds = { ...fallback.kinds }
    if (parsed.kinds && typeof parsed.kinds === 'object') {
      for (const kind of SNAP_KIND_ORDER) {
        if (typeof parsed.kinds[kind] === 'boolean') kinds[kind] = parsed.kinds[kind]
      }
    }
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
      kinds,
    }
  } catch {
    return fallback
  }
}

export function snapModes(settings: SnapSettings, suspended: boolean): AcDbOsnapMode[] {
  if (!settings.enabled || suspended) return []
  return SNAP_KIND_ORDER.filter((kind) => settings.kinds[kind]).map((kind) => KIND_MODE[kind])
}

export function snapMask(settings: SnapSettings, suspended: boolean): number {
  return acdbOsnapModesToMask(snapModes(settings, suspended))
}
