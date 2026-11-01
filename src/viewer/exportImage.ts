import type { AcTrView2d } from '@mlightcad/cad-simple-viewer'
import type { Point2 } from '../measure/math'

export interface ExportLabel {
  at: Point2
  text: string
}

function webglCanvas(container: HTMLElement): HTMLCanvasElement | null {
  for (const canvas of container.querySelectorAll('canvas')) {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (gl) return canvas
  }
  return container.querySelector('canvas')
}

function readFlipped(gl: WebGL2RenderingContext | WebGLRenderingContext): HTMLCanvasElement | null {
  const width = gl.drawingBufferWidth
  const height = gl.drawingBufferHeight
  if (width <= 0 || height <= 0) return null
  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  let ink = 0
  for (let i = 3; i < pixels.length; i += 16) ink += pixels[i] ?? 0
  if (ink === 0) return null
  const flipped = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y += 1) {
    const src = (height - 1 - y) * width * 4
    flipped.set(pixels.subarray(src, src + width * 4), y * width * 4)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = new ImageData(flipped, width, height)
  ctx.putImageData(image, 0, 0)
  return canvas
}

export async function captureView(
  view: AcTrView2d,
  labels: ExportLabel[],
  footer: string,
): Promise<string> {
  await document.fonts.load('16px "Lantu Sans"')
  const container = view.container
  view.activeLayoutView.render(view.cadScene)
  const source = webglCanvas(container)
  if (!source) throw new Error('missing canvas')
  const gl = source.getContext('webgl2') ?? source.getContext('webgl')
  const base = gl ? readFlipped(gl) : null
  const width = base?.width ?? source.width
  const height = base?.height ?? source.height
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d context')
  ctx.fillStyle = '#141816'
  ctx.fillRect(0, 0, width, height)
  if (base) ctx.drawImage(base, 0, 0)
  else ctx.drawImage(source, 0, 0)

  const rect = source.getBoundingClientRect()
  const scaleX = width / Math.max(source.clientWidth, 1)
  const scaleY = height / Math.max(source.clientHeight, 1)
  for (const canvas of container.querySelectorAll('canvas')) {
    if (canvas === source) continue
    const box = canvas.getBoundingClientRect()
    ctx.drawImage(
      canvas,
      (box.left - rect.left) * scaleX,
      (box.top - rect.top) * scaleY,
      box.width * scaleX,
      box.height * scaleY,
    )
  }

  ctx.save()
  ctx.font = `${Math.round(14 * scaleX)}px "Lantu Sans", sans-serif`
  ctx.textBaseline = 'middle'
  for (const label of labels) {
    const screen = view.worldToScreen(label.at)
    const x = screen.x * scaleX
    const y = screen.y * scaleY
    const pad = 6 * scaleX
    const metrics = ctx.measureText(label.text)
    const boxWidth = metrics.width + pad * 2
    const boxHeight = 22 * scaleY
    ctx.fillStyle = 'rgba(20, 24, 22, 0.88)'
    ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
    ctx.strokeStyle = '#e2a23a'
    ctx.lineWidth = Math.max(1, scaleX)
    ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
    ctx.fillStyle = '#f4efe4'
    ctx.textAlign = 'center'
    ctx.fillText(label.text, x, y)
  }
  ctx.restore()

  const bar = Math.round(28 * scaleY)
  ctx.fillStyle = 'rgba(16, 20, 18, 0.9)'
  ctx.fillRect(0, height - bar, width, bar)
  ctx.fillStyle = '#e7efe8'
  ctx.font = `${Math.round(13 * scaleX)}px "Lantu Sans", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(footer, 12 * scaleX, height - bar / 2)
  return out.toDataURL('image/png')
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('pdf image'))
    image.src = dataUrl
  })
}

export async function renderPdfBytes(dataUrl: string): Promise<Uint8Array> {
  const image = await loadImage(dataUrl)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = 297
  const pageHeight = 210
  const margin = 8
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2
  const ratio = image.width > 0 ? image.height / image.width : 0.7
  let width = maxWidth
  let height = width * ratio
  if (height > maxHeight) {
    height = maxHeight
    width = height / Math.max(ratio, 0.01)
  }
  const x = (pageWidth - width) / 2
  const y = (pageHeight - height) / 2
  pdf.addImage(dataUrl, 'PNG', x, y, width, height)
  return new Uint8Array(pdf.output('arraybuffer'))
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function downloadPdf(dataUrl: string, filename: string): Promise<void> {
  const bytes = await renderPdfBytes(dataUrl)
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  URL.revokeObjectURL(url)
}
