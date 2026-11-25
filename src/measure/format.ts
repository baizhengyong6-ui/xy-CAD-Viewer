/** Display strings for measurement results. Drawing units stay numeric until here. */

import { applyScale, convertArea, convertLength, formatNumber, unitSymbol } from './math'

export interface MeasureDisplay {
  /** AutoCAD INSUNITS of the drawing. 0 means unitless. */
  drawingUnit: number
  /** Selected display unit. -1 follows the drawing. */
  displayUnit: number
  precision: number
  /** Real = drawing × scale. Omit to show the drawing value without a scale. */
  scale?: number
}

/** -1 follows the drawing. A non-negative choice, including unitless 0, wins. */
export function resolveDisplayUnit(displayUnit: number, drawingUnit: number): number {
  if (displayUnit >= 0) return displayUnit
  return drawingUnit > 0 ? drawingUnit : 0
}

function withSymbol(text: string, unit: number, squared = false): string {
  const symbol = unitSymbol(unit)
  if (!symbol) return text
  return squared ? `${text} ${symbol}²` : `${text} ${symbol}`
}

export function formatLength(value: number, options: MeasureDisplay): string {
  const unit = resolveDisplayUnit(options.displayUnit, options.drawingUnit)
  const converted = convertLength(value, options.drawingUnit, unit)
  const shown = options.scale === undefined ? converted : applyScale(converted, options.scale)
  return withSymbol(formatNumber(shown, options.precision), unit)
}

export function formatArea(value: number, options: MeasureDisplay): string {
  const unit = resolveDisplayUnit(options.displayUnit, options.drawingUnit)
  const converted = convertArea(value, options.drawingUnit, unit)
  const shown =
    options.scale === undefined ? converted : applyScale(converted, options.scale * options.scale)
  return withSymbol(formatNumber(shown, options.precision), unit, true)
}

export function formatAngle(radians: number, precision: number): string {
  return `${formatNumber((radians * 180) / Math.PI, precision)}°`
}

export function formatPoint(x: number, y: number, precision: number): string {
  return `${formatNumber(x, precision)}, ${formatNumber(y, precision)}`
}

/** Copy text. Angle and point ignore scale; other types include both values when scale is not 1. */
export function formatMeasurementCopy(
  kind: string,
  type: string,
  drawing: string,
  scaled: string,
  scale: number,
  drawingLabel: string,
  scaledLabel: string,
): string {
  if (scale === 1 || type === 'angle' || type === 'point') return `${kind}  ${scaled}`
  return `${kind}  ${drawingLabel} ${drawing}  ${scaledLabel} 1:${scale} ${scaled}`
}
