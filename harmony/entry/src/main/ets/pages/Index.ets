import { common, Want } from '@kit.AbilityKit'
import { webview } from '@kit.ArkWeb'
import { fileIo, fileUri, picker } from '@kit.CoreFileKit'
import { util } from '@kit.ArkTS'
import { promptAction } from '@kit.ArkUI'
import { CadInbox } from '../common/CadInbox'

const HOST = 'https://xinyao.local/'

class HarmonyBridge {
  page: Index | null = null

  pick(): void {
    if (this.page) this.page.pickDocument()
  }

  share(name: string, mime: string, dataBase64: string): void {
    if (this.page) this.page.shareFile(name, mime, dataBase64)
  }
}

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController()
  schemeHandler: webview.WebSchemeHandler = new webview.WebSchemeHandler()
  bridge: HarmonyBridge = new HarmonyBridge()
  private schemeReady: boolean = false

  aboutToAppear(): void {
    this.bridge.page = this
    CadInbox.subscribe((id: string, name: string) => {
      this.openInbox(id, name)
    }, () => {
      this.showMemoryDialog()
    })
  }

  build() {
    Column() {
      Web({ src: 'about:blank', controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .onlineImageAccess(false)
        .mixedMode(MixedMode.All)
        .javaScriptProxy({
          object: this.bridge,
          name: 'XinyaoHarmony',
          methodList: ['pick', 'share'],
          controller: this.controller
        })
        .onControllerAttached(() => {
          this.installScheme()
          this.controller.loadUrl(`${HOST}index.html`)
        })
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
  }

  private installScheme(): void {
    if (this.schemeReady) return
    this.schemeReady = true
    this.schemeHandler.onRequestStart((request: webview.WebSchemeHandlerRequest, resourceHandler: webview.WebResourceHandler): boolean => {
      return this.handleRequest(request, resourceHandler)
    })
    this.schemeHandler.onRequestStop((_request: webview.WebSchemeHandlerRequest): void => {
    })
    this.controller.setWebSchemeHandler('https', this.schemeHandler)
  }

  private handleRequest(request: webview.WebSchemeHandlerRequest, resourceHandler: webview.WebResourceHandler): boolean {
    const url = request.getRequestUrl()
    if (!url.startsWith(HOST)) return false
    try {
      const inboxPrefix = `${HOST}inbox/`
      if (url.startsWith(inboxPrefix)) {
        const id = decodeURIComponent(url.substring(inboxPrefix.length).split('?')[0])
        const bytes = CadInbox.take(id)
        if (bytes === undefined) {
          resourceHandler.didFail(webview.WebNetErrorList.ERR_FILE_NOT_FOUND)
          return true
        }
        this.respond(resourceHandler, 'application/octet-stream', bytes, false)
        return true
      }
      const rawPath = rawFileFor(url)
      if (rawPath === '') {
        resourceHandler.didFail(webview.WebNetErrorList.ERR_FILE_NOT_FOUND)
        return true
      }
      const context = getContext(this) as common.UIAbilityContext
      const fileBytes = context.resourceManager.getRawFileContentSync(rawPath)
      this.respond(resourceHandler, mimeFor(rawPath), fileBytes, isText(rawPath))
      return true
    } catch (_error) {
      resourceHandler.didFail(webview.WebNetErrorList.ERR_FILE_NOT_FOUND)
      return true
    }
  }

  private respond(resourceHandler: webview.WebResourceHandler, mime: string, bytes: Uint8Array, text: boolean): void {
    const response = new webview.WebSchemeHandlerResponse()
    response.setNetErrorCode(webview.WebNetErrorList.NET_OK)
    response.setStatus(200)
    response.setStatusText('OK')
    response.setMimeType(mime)
    if (text) response.setEncoding('utf-8')
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    resourceHandler.didReceiveResponse(response)
    resourceHandler.didReceiveResponseBody(copy)
    resourceHandler.didFinish()
  }

  private openInbox(id: string, name: string): void {
    const script = `window.__xinyaoOpenInbox && window.__xinyaoOpenInbox(${JSON.stringify(id)}, ${JSON.stringify(name)})`
    this.controller.runJavaScript(script)
  }

  private showMemoryDialog(): void {
    promptAction.showDialog({
      title: '图纸太大',
      message: '这张图纸超过 96 MB，手机内存装不下。请换一张更小的图纸，或在电脑上打开。',
      buttons: [{ text: '知道了', color: '#E2A23A' }]
    })
  }

  pickDocument(): void {
    const context = getContext(this) as common.UIAbilityContext
    const documentPicker = new picker.DocumentViewPicker(context)
    const options = new picker.DocumentSelectOptions()
    options.fileSuffixFilters = ['.dwg', '.dxf', '.DWG', '.DXF']
    options.maxSelectNumber = 1
    documentPicker.select(options).then((uris: Array<string>) => {
      if (uris.length === 0) return
      CadInbox.importUri(uris[0])
    }).catch(() => {
    })
  }

  shareFile(name: string, mime: string, dataBase64: string): void {
    const context = getContext(this) as common.UIAbilityContext
    const helper = new util.Base64Helper()
    const bytes = helper.decodeSync(dataBase64)
    const path = `${context.cacheDir}/${safeName(name)}`
    const file = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC)
    fileIo.writeSync(file.fd, bytes.buffer)
    fileIo.closeSync(file)
    const uri = fileUri.getUriFromPath(path)
    const want: Want = {
      action: 'ohos.want.action.sendData',
      uri: uri,
      type: mime
    }
    context.startAbility(want)
  }
}

function rawFileFor(url: string): string {
  let path = url.substring(HOST.length).split('?')[0].split('#')[0]
  try {
    path = decodeURIComponent(path)
  } catch (_error) {
    return ''
  }
  if (path.includes('..') || path.startsWith('/')) return ''
  if (path.length === 0 || path.endsWith('/')) path = `${path}index.html`
  return `www/${path}`
}

function mimeFor(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.html')) return 'text/html'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript'
  if (lower.endsWith('.css')) return 'text/css'
  if (lower.endsWith('.wasm')) return 'application/wasm'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.otf')) return 'font/otf'
  if (lower.endsWith('.ttf')) return 'font/ttf'
  if (lower.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

function isText(path: string): boolean {
  const mime = mimeFor(path)
  return mime.startsWith('text/') || mime === 'application/json' || mime === 'image/svg+xml'
}

function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_')
  return cleaned.length === 0 ? 'export.bin' : cleaned
}
