# 览图

览图是一个开源（GPL-3.0）的跨平台 CAD 看图核心。第一阶段只交付浏览器里的静态 Web 应用：打开本地 DWG / DXF，平移缩放，开关图层，切换模型与布局，做距离、面积、角度和弧长测量，点选图元看特性，并把当前视图导出成带标注的 PNG 或 PDF。

后续外壳（macOS / Windows 的 Tauri 2、Android 的 Capacitor、HarmonyOS NEXT 的 ArkWeb）只需要把同一份 `dist` 包进壳，再把本地文件字节交给 `window.openCadFile`。应用不依赖服务器。

界面默认简体中文，文案在 `src/i18n`，可以切到英文。

## 功能

- 打开本地 `.dwg` / `.dxf`：文件选择、拖放，以及写在 IndexedDB 里的最近文件。
- 内置示例：直线、圆弧、多段线、填充、标注、块、中文文字、多图层和布局。
- 滚轮缩放、全图、放大缩小；选择模式下中键平移，平移工具下左键拖动。触屏沿用内核的双指缩放和拖动。
- 图层显示/隐藏；模型空间与图纸空间布局切换。
- 测量：距离、多边形面积、三点角度、弧长。捕捉端点、中点、圆心、交点。
- 单位（跟随图纸、毫米、厘米、米、英寸、英尺）、小数位，以及图面比例（1:1、1:10 等）。结果可复制。
- 点选图元查看类型、图层、长度或半径。
- 中文回退字体：打包 Noto Sans SC 的 GB2312 子集（SIL OFL），离线可用。
- 导出当前视图 PNG（含测量标注）；PDF 把同一张图排进 A4。

## 本地运行

需要 Node.js 22+。

```bash
npm install
npm run dev
```

开发服务器是 [http://127.0.0.1:43123](http://127.0.0.1:43123)。`npm run build` 生成纯静态的 `dist/`，再用 `npm run preview` 查看。

其他命令：

```bash
npm test          # 测量公式
npm run test:e2e  # Playwright：打开示例并测量 100 单位距离
npm run samples   # 用 ezdxf 重新生成 DXF；若 PATH 里有 dxf2dwg 则同时写 DWG
```

DWG 解析跑在 Web Worker 里。`npm run dev` / `npm run build` 会把 `libredwg-web.wasm` 和 worker 复制到 `public/workers`，再随静态目录发布。不要用 `file://` 直接打开 `index.html`：worker 和 wasm 需要 http(s) 或外壳自己的资源协议。

## 示例图纸

| 文件 | 内容 |
| --- | --- |
| `public/samples/dxf/measure-fixture.dxf` | 100 单位直线、圆、圆弧、三角形、中文 |
| `public/samples/dxf/plan-zh.dxf` | 一层平面：墙、门块、填充、标注、中文、图框布局 |
| `public/samples/dxf/entities.dxf` | 多段线、实心填充、块、对齐标注 |
| `public/samples/dwg/measure-fixture.dwg` | 上表 DXF 经 LibreDWG 写成的 R2000 |
| `public/samples/dwg/plan-zh.dwg` | 同上 |
| `public/samples/dwg/libredwg-*-r2004.dwg` | GNU LibreDWG 测试数据里的 R2004 直线和文字 |

DXF 由 `scripts/generate_samples.py` 生成，与本仓库一样按 GPL-3.0 授权。上游 DWG 的出处写在 `public/samples/dwg/SOURCE.txt`。

## 架构

```
src/
  session/useCadApp.ts    界面状态：打开、图层、布局、测量、导出
  dwg/types.ts            可替换的 DWG 解析器接口
  dwg/libredwg.ts         默认实现：@mlightcad/libredwg-converter（GPL-3.0）
  dwg/active.ts           当前启用哪一个解析器
  measure/math.ts         距离、面积、角度、弧长、单位和比例（有单测）
  viewer/                  特性、PNG/PDF
  shell/bridge.ts         window.openCadFile / window.lantu
  i18n/                   zh-CN 与 en
```

渲染和 DXF 解析来自 MIT 许可的 `@mlightcad/cad-simple-viewer`（Three.js）。DWG 不编进这个包：打开 `.dwg` 之前，`createDefaultDwgParser().register(workerUrl)` 向 `@mlightcad/data-model` 的转换器表登记 LibreDWG。换商业解析器时实现 `DwgParser`，并改 `src/dwg/active.ts`，外壳和界面不用动。

```ts
export interface DwgParser {
  readonly id: string
  readonly license: string
  register(workerUrl: string): void
}
```

字体目录是 `public/cad-data/`。`baseUrl` 指向它，`fonts/fonts.json` 把 `simsun`、`hztxt`、`gbcbig`、宋体、黑体等名字映射到同一份 Noto Sans SC。

### 给外壳的入口

页面加载后：

```js
await window.openCadFile('plan.dwg', arrayBuffer)
const client = window.lantu.worldToClient(0, 0) // 图纸坐标 → 视口 CSS 像素
```

`openCadFile` 返回 `Promise<boolean>`。壳负责系统文件选择和读字节，Web 核心负责解析和显示。

## 许可

整个应用以 **GNU GPL-3.0-only** 发布，因为默认 DWG 路径静态包含 LibreDWG 的 WebAssembly（`@mlightcad/libredwg-converter`、`@mlightcad/libredwg-web`，GPL-3.0）。

若产品不能接受 GPL，请不要分发这份 wasm 和 worker，改用实现了 `DwgParser` 的其他解析器，并单独确认其余依赖（查看器核心、Three.js、Vue 为 MIT；界面中文回退字体为 SIL OFL，见 `public/cad-data/fonts/OFL.txt`）。只开 DXF、不登记 DWG 转换器时，应用代码仍建议按 GPL 分发，除非已经去掉 GPL 产物。

## 路线图

1. **Tauri 2（macOS / Windows）**：把 `dist` 作为前端资源。系统打开对话框读出 `Uint8Array`，调用 `window.openCadFile`。确认 asset 协议能加载 `.wasm` 和 worker。
2. **Capacitor（Android）**：同样的静态资源和 `openCadFile`。用系统文档选择器，而不是再写一套解析。
3. **HarmonyOS NEXT（手机 / 平板 / PC）**：ArkTS 壳用 ArkWeb 加载这套页面。从沙箱或选择器得到字节后 `runJavaScript` 调 `openCadFile`。
4. **解析器**：复杂或较新的 DWG 可换成商业库，只替换 `src/dwg/active.ts`。
5. 图纸空间视口、SHX 大字体的字形宽度、以及把测量写回文件，留到后续阶段。

阶段一实际测到的结果、做不到的事和体积，见 [docs/phase1-report.md](docs/phase1-report.md)。
