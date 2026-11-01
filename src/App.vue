<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SAMPLE_FILES, useCadApp, type MeasureRow } from './session/useCadApp'
import { fetchAppInfo, isDesktopShell, type DesktopInfo } from './shell/desktop'
import { isMobileShell } from './shell/mobile'
import { APP_VERSION } from './version'
import type { PropertyRow } from './viewer/properties'

const { t, locale } = useI18n()
const host = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const scaleDraft = ref('1')
const showAbout = ref(false)
const about = ref<DesktopInfo | null>(null)
const cad = useCadApp()
const appVersion = APP_VERSION

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (!cad.state.showSamples && !cad.state.showRecent && !showAbout.value) return
  cad.state.showSamples = false
  cad.state.showRecent = false
  showAbout.value = false
  event.stopPropagation()
}

function requestOpen(): void {
  if (isDesktopShell()) void cad.openNative()
  else if (isMobileShell()) void cad.openMobile()
  else fileInput.value?.click()
}

async function openAbout(): Promise<void> {
  showAbout.value = true
  if (!about.value) about.value = await fetchAppInfo()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown, true)
  scaleDraft.value = String(cad.state.scale)
  const compact = window.matchMedia('(max-width: 900px)')
  const applyCompact = () => {
    if (compact.matches) {
      cad.state.showLayers = false
      cad.state.showInspect = false
    }
  }
  applyCompact()
  compact.addEventListener('change', applyCompact)
  if (host.value) await cad.mount(host.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true)
})

const hint = computed(() => t(`measure.hints.${cad.state.tool}`))

function chooseFiles(list: FileList | null): void {
  const file = list?.[0]
  if (file) void cad.openFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  chooseFiles(event.dataTransfer?.files ?? null)
}

function propLabel(row: PropertyRow): string {
  return t(`properties.${row.key}`)
}

function propValue(row: PropertyRow): string {
  if (row.key === 'type') {
    const key = `entity.${row.value}`
    const label = t(key)
    return label === key ? row.value : label
  }
  if (row.key === 'closed') return t(`properties.${row.value}`)
  return row.value
}

function layoutLabel(name: string): string {
  if (name === 'Model' || name === '模型') return t('layouts.model')
  return name
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function commitScale(): void {
  const value = Number(scaleDraft.value)
  if (Number.isFinite(value) && value > 0) cad.setScale(value)
  scaleDraft.value = String(cad.state.scale)
}

function applyPreset(scale: number): void {
  scaleDraft.value = String(scale)
  cad.setScale(scale)
}

function coordText(): string {
  const cursor = cad.state.cursor
  if (!cursor) return '—'
  const digits = cad.state.precision
  return `${cursor.x.toFixed(digits)}, ${cursor.y.toFixed(digits)}`
}

function measureKind(row: MeasureRow): string {
  return t(`measure.${row.type}`)
}
</script>

<template>
  <div
    class="app"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <header class="topbar">
      <div class="brand">
        <span class="mark" aria-hidden="true" />
        <div>
          <strong>{{ t('app.name') }}</strong>
          <small>{{ t('app.tagline') }}</small>
        </div>
      </div>

      <div class="tools">
        <button type="button" data-testid="open-file" @click="requestOpen()">
          {{ t('toolbar.open') }}
        </button>
        <button type="button" data-testid="open-samples" @click="cad.state.showSamples = true">
          {{ t('toolbar.samples') }}
        </button>
        <button type="button" data-testid="open-recent" @click="cad.state.showRecent = true">
          {{ t('toolbar.recent') }}
        </button>
        <span class="sep" />
        <button type="button" :class="{ on: cad.state.tool === 'pan' }" @click="cad.runTool('pan')">
          {{ t('toolbar.pan') }}
        </button>
        <button type="button" data-testid="zoom-out" @click="cad.zoomBy(1 / 1.25)">
          {{ t('toolbar.zoomOut') }}
        </button>
        <button type="button" data-testid="zoom-in" @click="cad.zoomBy(1.25)">
          {{ t('toolbar.zoomIn') }}
        </button>
        <button type="button" data-testid="zoom-extents" @click="cad.zoomExtents()">
          {{ t('toolbar.zoomExtents') }}
        </button>
        <span class="sep" />
        <button
          type="button"
          data-testid="tool-distance"
          :class="{ on: cad.state.tool === 'distance' }"
          @click="cad.runTool('distance')"
        >
          {{ t('toolbar.distance') }}
        </button>
        <button
          type="button"
          data-testid="tool-area"
          :class="{ on: cad.state.tool === 'area' }"
          @click="cad.runTool('area')"
        >
          {{ t('toolbar.area') }}
        </button>
        <button
          type="button"
          data-testid="tool-angle"
          :class="{ on: cad.state.tool === 'angle' }"
          @click="cad.runTool('angle')"
        >
          {{ t('toolbar.angle') }}
        </button>
        <button
          type="button"
          data-testid="tool-arc"
          :class="{ on: cad.state.tool === 'arc' }"
          @click="cad.runTool('arc')"
        >
          {{ t('toolbar.arc') }}
        </button>
        <button type="button" data-testid="clear-measures" @click="cad.clearMeasurements()">
          {{ t('toolbar.clear') }}
        </button>
        <span class="sep" />
        <button type="button" data-testid="export-png" @click="cad.exportPng()">{{ t('toolbar.png') }}</button>
        <button type="button" data-testid="export-pdf" @click="cad.exportPdf()">{{ t('toolbar.pdf') }}</button>
      </div>

      <div class="locale">
        <button type="button" data-testid="about" @click="openAbout()">{{ t('toolbar.about') }}</button>
        <button type="button" :class="{ on: locale === 'zh-CN' }" @click="cad.setViewerLocale('zh-CN')">中文</button>
        <button type="button" :class="{ on: locale === 'en' }" @click="cad.setViewerLocale('en')">EN</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="panel layers" :class="{ open: cad.state.showLayers }">
        <div class="panel-head">
          <h2>{{ t('layers.title') }}</h2>
          <button type="button" class="text" @click="cad.showAllLayers()">{{ t('layers.showAll') }}</button>
        </div>
        <p v-if="cad.state.layers.length === 0" class="muted">{{ t('layers.empty') }}</p>
        <ul v-else class="layer-list">
          <li v-for="layer in cad.state.layers" :key="layer.name">
            <label>
              <input
                type="checkbox"
                :checked="layer.isOn"
                @change="cad.toggleLayer(layer.name, ($event.target as HTMLInputElement).checked)"
              />
              <i :style="{ background: layer.cssColor }" />
              <span>{{ layer.name }}</span>
            </label>
            <em v-if="layer.isFrozen">{{ t('layers.frozen') }}</em>
          </li>
        </ul>
      </aside>

      <section
        class="stage"
        data-testid="stage"
        :data-view-ready="cad.state.viewReady ? 'true' : 'false'"
      >
        <div ref="host" class="host" data-testid="viewer-host" />
        <div v-if="!cad.state.hasDrawing && !cad.state.opening" class="empty">
          <h1>{{ t('empty.title') }}</h1>
          <p>{{ t('empty.body') }}</p>
          <div class="empty-actions">
            <button type="button" class="primary" @click="requestOpen()">{{ t('empty.open') }}</button>
            <button type="button" @click="cad.state.showSamples = true">{{ t('empty.samples') }}</button>
          </div>
        </div>
        <div v-if="cad.state.opening" class="scrim">
          <p>{{ t('status.opening', { name: cad.state.fileName || '…' }) }}</p>
          <div class="bar"><span :style="{ width: `${Math.max(cad.state.progress, 8)}%` }" /></div>
        </div>
        <div v-if="cad.state.layouts.length" class="layouts" data-testid="layouts">
          <button
            v-for="layout in cad.state.layouts"
            :key="layout.btrId"
            type="button"
            :class="{ on: layout.btrId === cad.state.activeLayoutId }"
            @click="cad.activateLayout(layout.btrId)"
          >
            {{ layoutLabel(layout.name) }}
          </button>
        </div>
      </section>

      <aside class="panel inspect" :class="{ open: cad.state.showInspect }">
        <section>
          <h2>{{ t('properties.title') }}</h2>
          <p v-if="cad.state.properties.length === 0" class="muted">{{ t('properties.empty') }}</p>
          <p v-else-if="cad.state.selectionCount > 1" class="muted">
            {{ t('properties.multiple', { count: cad.state.selectionCount }) }}
          </p>
          <dl v-if="cad.state.properties.length" data-testid="properties">
            <template v-for="row in cad.state.properties" :key="row.key + row.value">
              <dt>{{ propLabel(row) }}</dt>
              <dd>{{ propValue(row) }}</dd>
            </template>
          </dl>
        </section>
        <section>
          <h2>{{ t('measure.title') }}</h2>
          <div class="unit-row">
            <label>
              {{ t('units.label') }}
              <select :value="cad.state.unit" @change="cad.setUnit(Number(($event.target as HTMLSelectElement).value))">
                <option :value="-1">{{ t('units.follow') }}</option>
                <option :value="4">{{ t('units.mm') }}</option>
                <option :value="5">{{ t('units.cm') }}</option>
                <option :value="6">{{ t('units.m') }}</option>
                <option :value="1">{{ t('units.in') }}</option>
                <option :value="2">{{ t('units.ft') }}</option>
              </select>
            </label>
            <label>
              {{ t('units.precision') }}
              <select
                :value="cad.state.precision"
                @change="cad.setPrecision(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="n in 5" :key="n" :value="n - 1">{{ n - 1 }}</option>
              </select>
            </label>
          </div>
          <div class="scale-row">
            <span>{{ t('units.scale') }}</span>
            <button v-for="preset in [1, 10, 50, 100, 200]" :key="preset" type="button" :class="{ on: cad.state.scale === preset }" @click="applyPreset(preset)">
              1:{{ preset }}
            </button>
            <input v-model="scaleDraft" inputmode="decimal" @change="commitScale" />
          </div>
          <p class="muted scale-hint">{{ t('units.scaleHint') }}</p>
          <p v-if="cad.state.measurements.length === 0" class="muted">{{ t('measure.empty') }}</p>
          <ul v-else class="measures" data-testid="measure-list">
            <li v-for="row in cad.state.measurements" :key="row.id">
              <div>
                <strong>{{ measureKind(row) }}</strong>
                <b>{{ row.scaled }}</b>
                <small v-if="cad.state.scale !== 1 && row.type !== 'angle' && row.type !== 'point'">
                  {{ t('measure.drawing') }} {{ row.drawing }}
                </small>
              </div>
              <div class="row-actions">
                <button type="button" @click="cad.copyMeasurement(row)">
                  {{ cad.state.copiedId === row.id ? t('measure.copied') : t('measure.copy') }}
                </button>
                <button type="button" @click="cad.deleteMeasurement(row.id)">{{ t('measure.remove') }}</button>
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <footer class="statusbar">
      <span data-testid="file-name">{{ cad.state.fileName || t('status.noFile') }}</span>
      <span class="hint-inline">{{ hint }}</span>
      <span>{{ t('status.coords') }} {{ coordText() }}</span>
      <span class="snap">{{ t('status.snap') }}</span>
      <span class="mobile-toggles">
        <button type="button" @click="cad.state.showLayers = !cad.state.showLayers">{{ t('toolbar.layers') }}</button>
        <button type="button" @click="cad.state.showInspect = !cad.state.showInspect">{{ t('toolbar.inspect') }}</button>
      </span>
    </footer>

    <input
      ref="fileInput"
      class="sr-only"
      data-testid="file-input"
      type="file"
      accept=".dwg,.dxf,application/acad"
      @change="chooseFiles(($event.target as HTMLInputElement).files)"
    />

    <div v-if="dragging" class="dropmask">{{ t('empty.title') }}</div>

    <div v-if="cad.state.showSamples" class="modal" @click.self="cad.state.showSamples = false">
      <div class="sheet" role="dialog">
        <h2>{{ t('samples.title') }}</h2>
        <button
          v-for="sample in SAMPLE_FILES"
          :key="sample.id"
          type="button"
          :data-testid="`sample-${sample.id}`"
          @click="cad.openSample(sample.file)"
        >
          {{ t(sample.label) }}
        </button>
        <button type="button" class="text" @click="cad.state.showSamples = false">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="cad.state.showRecent" class="modal" @click.self="cad.state.showRecent = false">
      <div class="sheet" role="dialog">
        <h2>{{ t('recent.title') }}</h2>
        <p v-if="cad.state.recent.length === 0" class="muted">{{ t('recent.empty') }}</p>
        <div v-for="entry in cad.state.recent" :key="entry.id" class="recent-row">
          <button type="button" :disabled="!entry.stored" @click="cad.openRecent(entry)">
            {{ entry.name }}
            <small>{{ formatSize(entry.size) }}</small>
          </button>
          <button type="button" class="text" @click="cad.removeRecent(entry.id)">{{ t('recent.remove') }}</button>
        </div>
        <button type="button" class="text" @click="cad.state.showRecent = false">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="showAbout" class="modal" @click.self="showAbout = false">
      <div class="sheet" role="dialog" data-testid="about-dialog">
        <h2>{{ about?.name || t('app.name') }}</h2>
        <p>{{ t('about.version', { version: about?.version || appVersion }) }}</p>
        <p>{{ about?.notice || t('about.notice') }}</p>
        <p class="muted">{{ t('about.license', { license: about?.license || 'GPL-3.0-only' }) }}</p>
        <button type="button" class="text" @click="showAbout = false">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="cad.state.error || cad.state.notice" class="toast" role="status">
      <span>{{ cad.state.error || cad.state.notice }}</span>
      <button type="button" @click="cad.dismissError()">×</button>
    </div>
  </div>
</template>
