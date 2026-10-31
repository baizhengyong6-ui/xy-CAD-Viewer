# 阶段一报告

日期：2026-10-31。范围是共享 Web 核心，不是 Tauri / Capacitor / ArkWeb 壳。

## 能用的

- `npm run dev`（http://127.0.0.1:43123）和 `npm run build`。产物是静态 `dist/`，`vite preview` 下打开示例 DXF 成功。
- 文件选择、拖放、`window.openCadFile(name, ArrayBuffer)`、最近文件（IndexedDB，单文件上限约 30 MB，最多 8 条）。
- 示例 DXF：直线、圆弧、圆、多段线、实心填充和 ANSI31、线性/对齐标注、块、中文单行字和多行字、关闭的图层、模型与「图框」布局。
- 自生成 R2000 DWG（`measure-fixture.dwg`、`plan-zh.dwg`）能打开。平面图上的「客厅」「卧室」「览图示例 / 一层平面 · 中文标注」和填充都显示出来。沿外墙测距为 **12000.00 mm**。
- GNU LibreDWG 自带的 R2004 `Line.dwg`、`Text.dwg` 能打开。文字样例显示出英文多行文字，并列出模型、Layout1、Layout2。
- 测量（捕捉开启后在样例上点选）：
  - 距离 `(0,0)–(100,0)` → `100.00 mm`
  - 三角形面积 → `2500.00 mm²`
  - 直角 → `90.00°`
  - 半径 10 的四分之一圆 → `15.71 mm`（π×10/2）
- 点选圆：类型、图层「门窗」、半径 `10.00 mm`、周长 `62.83 mm`。
- 单位换算和比例在结果面板里生效；比例不是 1 时同时给出图面值和换算值。画布上的标注跟随查看器自己的单位，不乘比例。
- PNG 导出包含图线、中文和测量箭头/文字。PDF 使用同一张图，按 A4 横向排版（jspdf 按需加载）。
- 中文回退字体是 Noto Sans SC 的 GB2312 子集（约 1.9 MB，OFL），不依赖外网，也不打包有版权的 SHX / 宋体文件。
- 测试：`npm test` 7 个测量公式用例；Playwright 打开 `measure-fixture.dxf` 并完成距离测量。

## 做不到或不可靠的

- **DWG 兼容性受 LibreDWG 限制。** 读入覆盖大约 R13–R2018，但并不完整：R2007 写回本身就未完成；代理实体、部分标注、三维、AEC、以及一些填充/样条会缺或错。本阶段验证的是自建 R2000 和上游两个简单 R2004 文件，不能当成任意生产图纸的保证。
- `dxf2dwg` 转较复杂的 DXF 时会报 duplicate handle。仓库里的 R2000 文件仍然能打开，但不保证和 AutoCAD 字节级一致。
- **图纸空间视口。** 「图框」布局能显示「图框 · A3」标题，视口里的模型几何没有稳定地进入视野。模型空间是可靠的。
- **字体。** 没有随包提供 SHX 大字体，中文宽度和 AutoCAD 的 `hztxt` / `gbcbig` 不一致。超出 GB2312 的字可能缺字形。`%%c`、`%%d`、`%%p` 依赖的符号 SHX（如 `amgdt`）没有打包，这些符号会缺。
- 测量是视图上的 HTML/画布标注，不写回 DWG/DXF。换文件时会清掉。
- 多段线特性里的长度按直线段累加，鼓包圆弧只在「弧长」工具里按圆/弧处理。
- 交点捕捉由查看器内核提供，复杂重叠处不一定每次都吸到。
- 主脚本约 4.2 MB（gzip 1.1 MB），首屏偏重。PDF 相关的 jspdf / html2canvas 已拆成按需块。

## 体积（`npm run build` 的 `dist/`）

| 内容 | 大小 |
| --- | --- |
| 整个 `dist/` | 约 19 MB |
| `workers/libredwg-web.wasm` | 10.3 MB |
| 主脚本 `assets/index-*.js` | 4.2 MB（gzip 1.1 MB） |
| Noto Sans SC GB2312 子集 | 1.9 MB |
| `mtext-renderer-worker.js` | 1.2 MB |
| PDF 按需块（jspdf + html2canvas + purify） | 约 0.6 MB |
| LibreDWG parser worker | 198 KB |

Wasm 必须和 `libredwg-parser-worker.js` 放在同一目录，worker 用 `import.meta.url` 去找它。

## 阶段二建议

1. 壳只做文件字节和窗口：Tauri 2、Capacitor、ArkWeb 都调用现成的 `window.openCadFile`。先确认各自的资源协议能启动 worker 并实例化 wasm（不要假设 `file://` 可以）。
2. 需要吃下更多生产 DWG 时，实现 `src/dwg/types.ts` 的 `DwgParser`，替换 `src/dwg/active.ts`。商业解析器不要和 GPL 的 wasm 打进同一个闭源包。
3. 图纸空间：打开布局后按视口的 `view_center` / `view_height` 取景，而不是只按标题文字的外包盒缩放。
4. 若必须对齐 SHX 字宽，再评估可再分发的 SHX；在此之前继续用 OFL 的 TTF 子集，并在界面上说明这是替代字体。
5. 把 `@mlightcad/cad-simple-viewer` 继续拆包或延迟加载，避免 4 MB 主脚本挡在第一次打开之前。测量结果可另存 sidecar JSON（内核已有记录结构），为以后「带标注导出」留口。
