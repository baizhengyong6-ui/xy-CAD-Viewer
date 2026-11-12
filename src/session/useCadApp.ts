import {
  AcApDocManager,
  AcApI18n,
  AcApOpenViewMode,
  AcApSettingManager,
  AcEdOpenMode,
  AcEdViewMode,
  acapListFindLayouts,
  clearLayoutMeasurements,
  eventBus,
  listLayoutMeasurements,
  notifyMeasurementLayoutChanged,
  refreshMeasurementValueLabels,
  removeMeasurement,
  resetMeasurementUnitOverride,
  setMeasurementUnitOverride,
  subscribeMeasurements,
  type AcApMeasurementRecord,
  type AcTrView2d,
} from '@mlightcad/cad-simple-viewer'
import {
  SNAP_KIND_ORDER,
  SNAP_STORAGE_KEY,
  readSnapSettings,
  snapMask,
  type SnapKindFlags,
  type SnapSettings,
} from '../measure/osnapSettings'
import { FontManager } from '@mlightcad/mtext-renderer'
import { onBeforeUnmount, reactive } from 'vue'
import { createDefaultDwgParser } from '../dwg/active'
import { i18n } from '../i18n'
import {
  applyScale,
  arcLengthFromPoints,
  convertArea,
  convertLength,
  distance,
  formatNumber,
  interiorAngle,
  polygonArea,
  unitSymbol,
  type Point2,
} from '../measure/math'
import { cadDataBaseUrl, publicUrl } from '../runtime/assets'
import { forgetRecent, listRecent, loadRecent, rememberFile, type RecentFile } from '../storage/recent'
import { captureView, dataUrlToBytes, downloadDataUrl, downloadPdf, renderPdfBytes, type ExportLabel } from '../viewer/exportImage'
import { describeEntity, type PropertyRow } from '../viewer/properties'
import { installBridge } from '../shell/bridge'
import {
  bindDesktopOpens,
  isDesktopShell,
  noteRuntime,
  pickDrawingPath,
  readDrawingPath,
  saveExportFile,
} from '../shell/desktop'
import { harmonyInboxOpener, startHarmonyInbox } from '../shell/harmony'
import { formatByteSize, isMemoryFailure, MOBILE_DRAWING_LIMIT_BYTES } from '../shell/limits'
import {
  bindAndroidOpens,
  isAndroidShell,
  isHarmonyShell,
  isMobileShell,
  openAndroidDrawing,
  requestHarmonyPick,
  shareMobileFile,
} from '../shell/mobile'
import { configureTouchSnap } from '../shell/touchSnap'
import {
  canOpenAnotherTab,
  findTabByName,
  tabLimit,
  type TabModel,
} from './tabs'

export type ToolId = 'select' | 'pan' | 'distance' | 'area' | 'angle' | 'arc'

export interface LayerRow {
  name: string
  isOn: boolean
  isFrozen: boolean
  cssColor: string
}

export interface LayoutRow {
  name: string
  btrId: string
  tabOrder: number
}

export interface MeasureRow {
  id: string
  type: string
  drawing: string
  scaled: string
  copyText: string
}

const COMMANDS: Record<Exclude<ToolId, 'pan' | 'select'>, string> = {
  distance: 'measuredistance',
  area: 'measurearea',
  angle: 'measureangle',
  arc: 'measurearc',
}

const SETTINGS_KEY = 'lantu-settings'

export const SAMPLE_FILES = [
  { id: 'measure-fixture', file: 'dxf/measure-fixture.dxf', label: 'samples.measure' },
  { id: 'plan-zh', file: 'dxf/plan-zh.dxf', label: 'samples.plan' },
  { id: 'entities', file: 'dxf/entities.dxf', label: 'samples.entities' },
  { id: 'measure-dwg', file: 'dwg/measure-fixture.dwg', label: 'samples.measureDwg' },
  { id: 'plan-dwg', file: 'dwg/plan-zh.dwg', label: 'samples.planDwg' },
  { id: 'libredwg-line', file: 'dwg/libredwg-line-r2004.dwg', label: 'samples.libredwgLine' },
  { id: 'libredwg-text', file: 'dwg/libredwg-text-r2004.dwg', label: 'samples.libredwgText' },
] as const

function translate(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {})
}

function readSettings(): { unit: number; scale: number; precision: number } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { unit: -1, scale: 1, precision: 2 }
    const parsed = JSON.parse(raw) as { unit?: number; scale?: number; precision?: number }
    return {
      unit: typeof parsed.unit === 'number' ? parsed.unit : -1,
      scale: typeof parsed.scale === 'number' && parsed.scale > 0 ? parsed.scale : 1,
      precision: typeof parsed.precision === 'number' ? parsed.precision : 2,
    }
  } catch {
    return { unit: -1, scale: 1, precision: 2 }
  }
}

function pointOf(value: { x: number; y: number }): Point2 {
  return { x: value.x, y: value.y }
}

function centroid(points: Point2[]): Point2 {
  if (points.length === 0) return { x: 0, y: 0 }
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

function labelAt(record: AcApMeasurementRecord): Point2 {
  const geometry = record.geometry
  if (geometry.type === 'distance') {
    return {
      x: (geometry.start.x + geometry.end.x) / 2,
      y: (geometry.start.y + geometry.end.y) / 2,
    }
  }
  if (geometry.type === 'area') return centroid(geometry.points.map(pointOf))
  if (geometry.type === 'angle') return pointOf(geometry.vertex)
  if (geometry.type === 'arc') return pointOf(geometry.through ?? geometry.start)
  return pointOf(geometry.position)
}

export function useCadApp() {
  const saved = readSettings()
  const savedSnap = readSnapSettings(typeof localStorage === 'undefined' ? null : localStorage.getItem(SNAP_STORAGE_KEY))
  const state = reactive({
    ready: false,
    opening: false,
    progress: 0,
    hasDrawing: false,
    viewReady: false,
    fileName: '',
    tabs: [] as TabModel[],
    activeTabId: '',
    showLayerMenu: false,
    showSnapMenu: false,
    snapEnabled: savedSnap.enabled,
    snapSuspended: false,
    snapKinds: savedSnap.kinds,
    error: '',
    notice: '',
    tool: 'select' as ToolId,
    layers: [] as LayerRow[],
    layouts: [] as LayoutRow[],
    activeLayoutId: '',
    properties: [] as PropertyRow[],
    selectionCount: 0,
    measurements: [] as MeasureRow[],
    recent: [] as RecentFile[],
    showSamples: false,
    showRecentPanel: typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches,
    showInspect: true,
    unit: saved.unit,
    scale: saved.scale,
    precision: saved.precision,
    cursor: null as Point2 | null,
    copiedId: '',
  })

  let toolToken = 0
  let stopMeasure: (() => void) | null = null
  let layerListener: ((payload: { layers: LayerRow[] }) => void) | null = null
  let boundLayerStore: { events: { changed: { removeEventListener(listener: (payload: { layers: LayerRow[] }) => void): void } } } | null = null
  let selectionListener: (() => void) | null = null
  const tabIds = new WeakMap<object, string>()
  let tabSequence = 1

  function mobileTabs(): boolean {
    if (isMobileShell()) return true
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  }

  function tabIdFor(doc: object): string {
    const existing = tabIds.get(doc)
    if (existing) return existing
    const id = `tab-${tabSequence}`
    tabSequence += 1
    tabIds.set(doc, id)
    return id
  }

  function openDocuments() {
    try {
      return AcApDocManager.instance.documents.filter((doc) => doc.fileName && !doc.isReusableUntitled)
    } catch {
      return []
    }
  }

  function documentForTab(id: string) {
    return openDocuments().find((doc) => tabIdFor(doc) === id)
  }

  function currentSnap(): SnapSettings {
    return { enabled: state.snapEnabled, kinds: { ...state.snapKinds } }
  }

  function applySnap(save: boolean): void {
    AcApSettingManager.instance.set('osnapModes', snapMask(currentSnap(), state.snapSuspended), { persist: false })
    if (!save || typeof localStorage === 'undefined') return
    localStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(currentSnap()))
  }

  function persistSettings(): void {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ unit: state.unit, scale: state.scale, precision: state.precision }),
    )
  }

  function view(): AcTrView2d | null {
    try {
      return AcApDocManager.instance.curView
    } catch {
      return null
    }
  }

  function drawingUnits(): number {
    try {
      return AcApDocManager.instance.curDocument.database.insunits ?? 0
    } catch {
      return 0
    }
  }

  function targetUnit(): number {
    if (state.unit >= 0) return state.unit
    const drawing = drawingUnits()
    return drawing > 0 ? drawing : 0
  }

  function formatLength(value: number): string {
    const shown = applyScale(convertLength(value, drawingUnits(), targetUnit()), state.scale)
    const symbol = unitSymbol(targetUnit())
    return symbol ? `${formatNumber(shown, state.precision)} ${symbol}` : formatNumber(shown, state.precision)
  }

  function formatArea(value: number): string {
    const shown = applyScale(convertArea(value, drawingUnits(), targetUnit()), state.scale * state.scale)
    const symbol = unitSymbol(targetUnit())
    return symbol ? `${formatNumber(shown, state.precision)} ${symbol}²` : formatNumber(shown, state.precision)
  }

  function formatAngle(radians: number): string {
    return `${formatNumber((radians * 180) / Math.PI, state.precision)}°`
  }

  function refreshMeasurements(): void {
    const current = view()
    if (!current || !state.hasDrawing) {
      state.measurements = []
      return
    }
    state.measurements = listLayoutMeasurements(current).map((record) => {
      const built = summarize(record)
      return {
        id: record.id,
        type: record.type,
        drawing: built.drawing,
        scaled: built.scaled,
        copyText: built.copyText,
      }
    })
  }

  function summarize(record: AcApMeasurementRecord): { drawing: string; scaled: string; copyText: string } {
    const geometry = record.geometry
    const kind = translate(`measure.${record.type}`)
    let drawing = ''
    let scaled = ''
    if (geometry.type === 'distance') {
      const raw = distance(pointOf(geometry.start), pointOf(geometry.end))
      drawing = unscaledLength(raw)
      scaled = formatLength(raw)
    } else if (geometry.type === 'area') {
      const raw = polygonArea(geometry.points.map(pointOf))
      drawing = unscaledArea(raw)
      scaled = formatArea(raw)
    } else if (geometry.type === 'angle') {
      const raw = interiorAngle(pointOf(geometry.arm1), pointOf(geometry.vertex), pointOf(geometry.arm2))
      drawing = formatAngle(raw)
      scaled = drawing
    } else if (geometry.type === 'arc') {
      const raw = arcLengthFromPoints(
        pointOf(geometry.center),
        geometry.radius,
        pointOf(geometry.start),
        pointOf(geometry.end),
        geometry.through ? pointOf(geometry.through) : undefined,
      )
      drawing = unscaledLength(raw)
      scaled = formatLength(raw)
    } else {
      drawing = `${formatNumber(geometry.position.x, state.precision)}, ${formatNumber(geometry.position.y, state.precision)}`
      scaled = drawing
    }
    const copyText = state.scale === 1 || geometry.type === 'angle' || geometry.type === 'point'
      ? `${kind}  ${scaled}`
      : `${kind}  ${translate('measure.drawing')} ${drawing}  ${translate('measure.scaled')} 1:${state.scale} ${scaled}`
    return { drawing, scaled, copyText }
  }

  function unscaledLength(raw: number): string {
    const shown = convertLength(raw, drawingUnits(), targetUnit())
    const symbol = unitSymbol(targetUnit())
    return symbol ? `${formatNumber(shown, state.precision)} ${symbol}` : formatNumber(shown, state.precision)
  }

  function unscaledArea(raw: number): string {
    const shown = convertArea(raw, drawingUnits(), targetUnit())
    const symbol = unitSymbol(targetUnit())
    return symbol ? `${formatNumber(shown, state.precision)} ${symbol}²` : formatNumber(shown, state.precision)
  }

  function unbindLayers(): void {
    if (layerListener && boundLayerStore) boundLayerStore.events.changed.removeEventListener(layerListener)
    boundLayerStore = null
  }

  function refreshLayers(): void {
    unbindLayers()
    if (!state.hasDrawing) {
      state.layers = []
      return
    }
    const store = AcApDocManager.instance.curDocument.layerStore
    state.layers = store.getLayers().map((layer) => ({
      name: layer.name,
      isOn: layer.isOn,
      isFrozen: layer.isFrozen,
      cssColor: layer.cssColor,
    }))
    layerListener = (payload) => {
      state.layers = payload.layers.map((layer) => ({
        name: layer.name,
        isOn: layer.isOn,
        isFrozen: layer.isFrozen,
        cssColor: layer.cssColor,
      }))
    }
    store.events.changed.addEventListener(layerListener)
    boundLayerStore = store
  }

  function syncDocumentUi(): void {
    const docs = openDocuments()
    state.tabs = docs.map((doc) => ({ id: tabIdFor(doc), name: doc.fileName }))
    let currentName = ''
    let currentId = ''
    try {
      const current = AcApDocManager.instance.curDocument
      if (current.fileName && !current.isReusableUntitled) {
        currentName = current.fileName
        currentId = tabIdFor(current)
      }
    } catch {
      currentName = ''
      currentId = ''
    }
    state.fileName = currentName
    state.activeTabId = currentId
    state.hasDrawing = currentId !== ''
    if (!state.hasDrawing) {
      state.viewReady = false
      state.layouts = []
      state.activeLayoutId = ''
      state.properties = []
      state.selectionCount = 0
      state.measurements = []
      state.layers = []
      unbindLayers()
      return
    }
    refreshLayers()
    refreshLayouts()
    refreshProperties()
    refreshMeasurements()
  }

  function refreshLayouts(): void {
    if (!state.hasDrawing) {
      state.layouts = []
      state.activeLayoutId = ''
      return
    }
    const db = AcApDocManager.instance.curDocument.database
    const current = view()
    state.layouts = acapListFindLayouts(db).map((layout) => ({
      name: layout.name,
      btrId: layout.btrId,
      tabOrder: layout.tabOrder,
    }))
    state.activeLayoutId = current?.activeLayoutBtrId ?? state.layouts[0]?.btrId ?? ''
  }

  function refreshProperties(): void {
    const current = view()
    if (!current || !state.hasDrawing) {
      state.properties = []
      state.selectionCount = 0
      return
    }
    const ids = current.selectionSet.ids
    state.selectionCount = ids.length
    const first = ids[0]
    if (!first) {
      state.properties = []
      return
    }
    const entity = AcApDocManager.instance.curDocument.database.getObjectById(first)
    if (!entity) {
      state.properties = []
      return
    }
    state.properties = describeEntity(entity, unscaledLength, unscaledArea)
  }

  function syncViewerUnits(): void {
    const current = view()
    if (!current || !state.hasDrawing) return
    if (state.unit < 0) resetMeasurementUnitOverride()
    else setMeasurementUnitOverride({ lengthUnit: state.unit })
    refreshMeasurementValueLabels(current, AcApDocManager.instance.curDocument.database)
    refreshMeasurements()
  }

  async function openBuffer(name: string, data: ArrayBuffer, remember: boolean): Promise<boolean> {
    const lower = name.toLowerCase()
    if (!lower.endsWith('.dwg') && !lower.endsWith('.dxf')) {
      state.error = translate('errors.type')
      return false
    }
    if (isMobileShell() && data.byteLength > MOBILE_DRAWING_LIMIT_BYTES) {
      state.error = translate('errors.memory', { size: formatByteSize(data.byteLength) })
      return false
    }
    const existing = findTabByName(state.tabs, name)
    if (existing) {
      state.showSamples = false
      state.showLayerMenu = false
      await activateTab(existing.id)
      return true
    }
    if (!canOpenAnotherTab(openDocuments().length, mobileTabs(), false)) {
      state.error = translate('tabs.tooMany', { count: tabLimit(mobileTabs()) })
      state.showSamples = false
      return false
    }
    state.opening = true
    state.progress = 0
    state.error = ''
    state.viewReady = false
    state.showSamples = false
    state.showLayerMenu = false
    try {
      const ok = await AcApDocManager.instance.openDocument(name, data, {
        mode: AcEdOpenMode.Read,
        progressiveRendering: true,
        openViewMode: AcApOpenViewMode.Extents,
        minimumChunkSize: 400,
        convertAllLayouts: true,
      })
      if (!ok) {
        state.error = translate('errors.open')
        return false
      }
      syncDocumentUi()
      const opened = view()
      if (opened) clearLayoutMeasurements(opened)
      state.measurements = []
      syncViewerUnits()
      const current = view()
      configureTouchSnap(current, () => state.snapEnabled && !state.snapSuspended)
      if (current) {
        await current.waitUntilIdle(20000)
        current.zoomToFitDrawing()
      }
      state.viewReady = true
      setNavigation('select')
      if (remember) {
        try {
          await rememberFile(name, data)
          state.recent = await listRecent()
        } catch {
          state.recent = await listRecent()
        }
      }
      return true
    } catch (error) {
      console.error(error)
      state.error = isMemoryFailure(error) ? translate('errors.memoryFail') : translate('errors.open')
      return false
    } finally {
      state.opening = false
    }
  }

  async function openFile(file: File): Promise<void> {
    await openBuffer(file.name, await file.arrayBuffer(), true)
  }

  async function openSample(file: string): Promise<void> {
    const response = await fetch(publicUrl(`samples/${file}`))
    if (!response.ok) {
      state.error = translate('errors.open')
      state.showSamples = false
      return
    }
    const name = file.split('/').pop() ?? file
    await openBuffer(name, await response.arrayBuffer(), false)
  }

  async function activateTab(id: string): Promise<void> {
    const doc = documentForTab(id)
    if (!doc) return
    state.showLayerMenu = false
    const ok = await AcApDocManager.instance.activateDocument(doc)
    if (!ok) return
    syncDocumentUi()
    state.viewReady = true
    setNavigation('select')
  }

  async function closeTab(id: string): Promise<void> {
    const doc = documentForTab(id)
    if (!doc) return
    state.showLayerMenu = false
    await AcApDocManager.instance.closeDocument(doc)
    syncDocumentUi()
    if (state.hasDrawing) state.viewReady = true
  }

  async function openRecent(entry: RecentFile): Promise<void> {
    if (!entry.stored) {
      state.error = translate('recent.unavailable')
      return
    }
    const data = await loadRecent(entry.id)
    if (!data) {
      state.error = translate('recent.unavailable')
      return
    }
    await openBuffer(entry.name, data, true)
  }

  function setNavigation(tool: 'select' | 'pan'): void {
    const current = view()
    if (current) current.mode = tool === 'pan' ? AcEdViewMode.PAN : AcEdViewMode.SELECTION
    state.tool = tool
  }

  async function runTool(tool: ToolId): Promise<void> {
    if (!state.hasDrawing) {
      state.error = translate('errors.empty')
      return
    }
    const token = ++toolToken
    AcApDocManager.instance.editor.cancelActiveInput()
    if (tool === 'pan') {
      setNavigation(state.tool === 'pan' ? 'select' : 'pan')
      return
    }
    if (tool === 'select') {
      setNavigation('select')
      return
    }
    state.tool = tool
    try {
      await AcApDocManager.instance.executeCommandString(COMMANDS[tool])
    } catch (error) {
      console.error(error)
    } finally {
      if (toolToken === token) setNavigation('select')
      refreshMeasurements()
    }
  }

  function worldToClient(x: number, y: number): Point2 | null {
    const current = view()
    if (!current) return null
    const canvas = current.container.querySelector('canvas')
    if (!canvas) return null
    const screen = current.worldToScreen({ x, y })
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / Math.max(canvas.clientWidth, 1)
    const scaleY = rect.height / Math.max(canvas.clientHeight, 1)
    return { x: rect.left + screen.x * scaleX, y: rect.top + screen.y * scaleY }
  }

  async function mount(host: HTMLElement): Promise<void> {
    AcApI18n.setCurrentLocale(i18n.global.locale.value === 'en' ? 'en' : 'zh')
    const baseUrl = cadDataBaseUrl()
    FontManager.instance.baseUrl = baseUrl
    FontManager.instance.setDefaultFonts(['simsun'])
    FontManager.instance.setFontMapping({
      hztxt: 'simsun',
      gbcbig: 'simsun',
      txt: 'simsun',
      simplex: 'simsun',
      romans: 'simsun',
      Arial: 'simsun',
      '宋体': 'simsun',
      '黑体': 'simsun',
      '微软雅黑': 'simsun',
      '楷体': 'simsun',
    })
    const dwgParser = publicUrl('workers/libredwg-parser-worker.js')
    const mtext = publicUrl('workers/mtext-renderer-worker.js')
    createDefaultDwgParser().register(dwgParser)
    AcApDocManager.createInstance({
      container: host,
      autoResize: true,
      baseUrl,
      preloadDefaultFonts: true,
      builtinOpenFileDialog: false,
      notificationCenter: false,
      webworkerFileUrls: { dwgParser, mtextRender: mtext },
    })
    configureTouchSnap(view(), () => state.snapEnabled && !state.snapSuspended)
    applySnap(false)
    await AcApDocManager.instance.loadDefaultFonts(['simsun'])
    stopMeasure = subscribeMeasurements(() => refreshMeasurements())
    selectionListener = () => refreshProperties()
    const selection = AcApDocManager.instance.curView.selectionSet
    selection.events.selectionAdded.addEventListener(selectionListener)
    selection.events.selectionRemoved.addEventListener(selectionListener)
    eventBus.on('open-file-progress', (payload: { percentage?: number }) => {
      if (typeof payload.percentage === 'number') state.progress = payload.percentage
    })
    eventBus.on('fonts-not-found', () => {
      state.notice = translate('errors.font')
    })
    eventBus.on('failed-to-open-file', () => {
      state.error = translate('errors.open')
      state.opening = false
    })
    host.addEventListener('pointermove', (event) => {
      const current = view()
      const canvas = host.querySelector('canvas')
      if (!current || !canvas || !state.hasDrawing) return
      const rect = canvas.getBoundingClientRect()
      const local = current.screenToWorld({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      state.cursor = { x: local.x, y: local.y }
    })
    installBridge({
      openCadFile: (name, data) => openBuffer(name, data, true),
      worldToClient,
    })
    if (isDesktopShell()) {
      void probeDesktopAssets()
      void bindDesktopOpens(async (path) => {
        const drawing = await readDrawingPath(path)
        const size = drawing.data.byteLength
        const opened = await openBuffer(drawing.name, drawing.data, true)
        await noteRuntime(`opened ${path} name=${drawing.name} bytes=${size} ok=${opened}`)
      })
    }
    if (isAndroidShell()) {
      const report = (error: unknown) => {
        console.error(error)
        const message = error instanceof Error ? error.message : String(error)
        if (isMemoryFailure(error) || message.includes('out of memory')) state.error = translate('errors.memoryFail')
        else if (message.includes('unsupported type')) state.error = translate('errors.type')
        else state.error = translate('errors.open')
      }
      void bindAndroidOpens(report).catch(report)
    }
    if (isHarmonyShell()) {
      startHarmonyInbox(async (id, name) => {
        try {
          await harmonyInboxOpener()(id, name)
        } catch (error) {
          console.error(error)
          state.error = isMemoryFailure(error) ? translate('errors.memoryFail') : translate('errors.open')
        }
      })
    }
    state.recent = await listRecent()
    state.ready = true
  }

  async function probeDesktopAssets(): Promise<void> {
    const urls = [
      publicUrl('workers/libredwg-parser-worker.js'),
      publicUrl('workers/libredwg-web.wasm'),
      publicUrl('workers/mtext-renderer-worker.js'),
      publicUrl('cad-data/fonts/fonts.json'),
      publicUrl('cad-data/fonts/NotoSansSC-Regular.otf'),
    ]
    for (const url of urls) {
      try {
        const response = await fetch(url)
        await noteRuntime(
          `asset ${response.status} ${response.headers.get('content-type') ?? ''} ${url}`,
        )
      } catch (error) {
        await noteRuntime(`asset error ${url} ${String(error)}`)
      }
    }
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    const renderer = gl ? String(gl.getParameter(gl.RENDERER)) : 'unavailable'
    await noteRuntime(`webgl ${gl ? 'ok' : 'missing'} ${renderer} origin=${window.location.origin}`)
  }

  async function openNative(): Promise<void> {
    const path = await pickDrawingPath()
    if (!path) return
    const drawing = await readDrawingPath(path)
    await openBuffer(drawing.name, drawing.data, true)
  }

  function exportLabels(): ExportLabel[] {
    const current = view()
    if (!current) return []
    return listLayoutMeasurements(current).map((record) => {
      const row = state.measurements.find((item) => item.id === record.id)
      return { at: labelAt(record), text: row?.scaled ?? row?.drawing ?? '' }
    })
  }

  async function exportPng(): Promise<void> {
    const current = view()
    if (!current || !state.hasDrawing) {
      state.error = translate('errors.empty')
      return
    }
    try {
      const footer = translate('export.footer', { name: state.fileName })
      const dataUrl = await captureView(current, exportLabels(), footer)
      const stem = state.fileName.replace(/\.(dwg|dxf)$/i, '')
      const bytes = dataUrlToBytes(dataUrl)
      if (isMobileShell()) await shareMobileFile('png', bytes, `${stem}.png`)
      else if (isDesktopShell()) await saveExportFile('png', bytes, `${stem}.png`)
      else downloadDataUrl(dataUrl, `${stem}.png`)
    } catch (error) {
      console.error(error)
      state.error = translate('errors.export')
    }
  }

  async function exportPdf(): Promise<void> {
    const current = view()
    if (!current || !state.hasDrawing) {
      state.error = translate('errors.empty')
      return
    }
    try {
      const footer = translate('export.footer', { name: state.fileName })
      const dataUrl = await captureView(current, exportLabels(), footer)
      const stem = state.fileName.replace(/\.(dwg|dxf)$/i, '')
      const bytes = await renderPdfBytes(dataUrl)
      if (isMobileShell()) await shareMobileFile('pdf', bytes, `${stem}.pdf`)
      else if (isDesktopShell()) await saveExportFile('pdf', bytes, `${stem}.pdf`)
      else await downloadPdf(dataUrl, `${stem}.pdf`)
    } catch (error) {
      console.error(error)
      state.error = translate('errors.export')
    }
  }

  onBeforeUnmount(() => {
    stopMeasure?.()
    unbindLayers()
  })

  return {
    state,
    mount,
    openFile,
    openNative,
    async openMobile() {
      try {
        if (isAndroidShell()) await openAndroidDrawing()
        else if (isHarmonyShell()) requestHarmonyPick()
        else state.error = translate('errors.open')
      } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : String(error)
        if (isMemoryFailure(error) || message.includes('out of memory')) state.error = translate('errors.memoryFail')
        else if (message.includes('unsupported type')) state.error = translate('errors.type')
        else state.error = translate('errors.open')
      }
    },
    openSample,
    openRecent,
    activateTab,
    closeTab,
    toggleSnap() {
      state.snapEnabled = !state.snapEnabled
      state.showSnapMenu = false
      applySnap(true)
    },
    setSnapKind(kind: keyof SnapKindFlags, on: boolean) {
      state.snapKinds = { ...state.snapKinds, [kind]: on }
      applySnap(true)
    },
    setSnapSuspended(suspended: boolean) {
      if (state.snapSuspended === suspended) return
      state.snapSuspended = suspended
      applySnap(false)
    },
    snapKindOrder: SNAP_KIND_ORDER,
    async removeRecent(id: string) {
      await forgetRecent(id)
      state.recent = await listRecent()
    },
    toggleLayer(name: string, isOn: boolean) {
      AcApDocManager.instance.curDocument.layerStore.setLayerOn(name, isOn)
    },
    showAllLayers() {
      AcApDocManager.instance.curDocument.layerStore.setAllLayersOn()
    },
    activateLayout(btrId: string) {
      const current = view()
      if (!current) return
      current.activeLayoutBtrId = btrId
      state.activeLayoutId = btrId
      notifyMeasurementLayoutChanged()
      current.zoomToFitDrawing(undefined, btrId)
      refreshMeasurements()
    },
    zoomExtents() {
      view()?.zoomToFitDrawing()
    },
    zoomBy(factor: number) {
      const current = view()
      if (!current) return
      const rect = current.container.getBoundingClientRect()
      const center = current.screenToWorld({ x: rect.width / 2, y: rect.height / 2 })
      current.flyTo({ x: center.x, y: center.y }, current.internalCamera.zoom * factor)
    },
    runTool,
    clearMeasurements() {
      const current = view()
      if (!current) return
      clearLayoutMeasurements(current)
      refreshMeasurements()
    },
    deleteMeasurement(id: string) {
      const current = view()
      if (!current) return
      removeMeasurement(current, id)
      refreshMeasurements()
    },
    async copyMeasurement(row: MeasureRow) {
      try {
        await navigator.clipboard.writeText(row.copyText)
      } catch {
        const area = document.createElement('textarea')
        area.value = row.copyText
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
      state.copiedId = row.id
      window.setTimeout(() => {
        if (state.copiedId === row.id) state.copiedId = ''
      }, 1200)
    },
    setUnit(unit: number) {
      state.unit = unit
      persistSettings()
      syncViewerUnits()
    },
    setScale(scale: number) {
      state.scale = scale > 0 ? scale : 1
      persistSettings()
      refreshMeasurements()
    },
    setPrecision(precision: number) {
      state.precision = precision
      persistSettings()
      refreshMeasurements()
      refreshProperties()
    },
    setViewerLocale(locale: 'zh-CN' | 'en') {
      i18n.global.locale.value = locale
      AcApI18n.setCurrentLocale(locale === 'en' ? 'en' : 'zh')
    },
    exportPng,
    exportPdf,
    dismissError() {
      state.error = ''
      state.notice = ''
    },
  }
}
