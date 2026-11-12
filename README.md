# 鑫垚CAD看图

鑫垚CAD看图（Xinyao CAD Viewer）是一个开源（GPL-3.0）的跨平台 CAD 看图程序。浏览器里是同一套静态 Web 核心；桌面版用 Tauri 2 把这份核心包进系统窗口。打开本地 DWG / DXF，平移缩放，开关图层，切换模型与布局，做距离、面积、角度和弧长测量，点选图元看特性，并把当前视图导出成带标注的 PNG 或 PDF。

应用不依赖服务器。界面默认简体中文，文案在 `src/i18n`，可以切到英文。窗口标题是「鑫垚CAD看图」。安装包和可执行文件名用 ASCII `XinyaoCADViewer`，避免 Windows 资源编译器拒绝非 ASCII 版本信息。

源码仓库：[github.com/baizhengyong6-ui/xy-CAD-Viewer](https://github.com/baizhengyong6-ui/xy-CAD-Viewer)。

## 下载

桌面安装包在 [Releases](https://github.com/baizhengyong6-ui/xy-CAD-Viewer/releases)。推送 `v*` 标签（例如 `v0.3.0`）后，GitHub Actions 会构建并挂到该版本：

- macOS：universal DMG（Apple Silicon 与 Intel）
- Windows：NSIS 安装程序（`.exe`）和 MSI
- Android：已签名的 release APK（`.aab` 只放在该次 Actions 的 Artifacts 里）

这些桌面包目前未签名。Android 的 APK 用仓库里的测试证书签名，才能直接安装；换成你自己的上传密钥见下文。`main` 每次推送也会构建，安装包在该次 Actions 运行的 Artifacts 里，不会自动发 Release。许可证是 GPL-3.0，仓库根目录的 `LICENSE` 会打进 Windows 安装向导。

应用版本号是 `package.json` 的 `version`。它必须和 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、Android `versionName`、HarmonyOS `versionName` 一致，否则安装包文件名会和 Git 标签对不上。`npm test` 里的版本检查会盯着这几处。

## 功能

- 打开本地 `.dwg` / `.dxf`：文件选择、拖放，以及写在 IndexedDB 里的最近文件。
- 内置示例：直线、圆弧、多段线、填充、标注、块、中文文字、多图层和布局。
- 滚轮缩放、全图、放大缩小；选择模式下中键平移，平移工具下左键拖动。触屏沿用内核的双指缩放和拖动。
- 图层显示/隐藏放在顶部工具栏的图层菜单里；模型空间与图纸空间布局切换。
- 多张图纸用顶部标签同时打开。切换标签会回到该图纸的视图、图层和测量；关掉标签会释放这块图纸。已经打开的文件再打开一次，会切到原来的标签。手机上同时最多 3 张，桌面最多 8 张。
- 左侧是最近打开的图纸（文件名和时间），可以收回。窄屏时它变成抽屉，把画面留给图纸。
- 测量：距离、多边形面积、三点角度、弧长。捕捉端点、中点、圆心、交点、最近点、垂足和象限点。工具栏可以开关捕捉和每一种类型，F3 切换，按住 Shift 暂时关闭。手机上孔径更大，并有放大镜和偏移十字光标。
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

## 桌面版

源码在 `src-tauri/`。需要 Rust 1.77+、以及各平台的 WebView 依赖（Linux 是 WebKitGTK 4.1，Windows 是 WebView2，macOS 是系统 WKWebView）。LibreDWG 的 wasm 不进 git，`npm install` 之后由构建脚本复制；仓库里最大的文件是约 2 MB 的字体子集，不需要 Git LFS。

```bash
npm install
npm run desktop:dev     # 开发：连到上面的 Vite
npm run desktop:build   # 为本机平台打安装包
```

命令行打开图纸，以及双击 / “打开方式”关联的 `.dwg`、`.dxf`，都会交给 `window.openCadFile`。程序是单实例：已经开着时再打开另一个文件，会交给当前窗口。桌面上的「打开」和 PNG/PDF 导出使用系统对话框。「关于」里写明 GPL-3.0 和 LibreDWG。

在 Linux 上交叉编译 Windows NSIS 安装包（实验性，不能打 MSI）：

```bash
sudo apt install nsis lld llvm clang
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

产物在 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。MSI 需要在 Windows 上用 WiX 构建。macOS 的 `.dmg` 只能在 Mac 上构建，本仓库的 GitHub Actions 工作流 `.github/workflows/desktop.yml` 会在 `macos-latest` 上打 universal dmg，并在 `windows-latest` 上打 NSIS 和 MSI。

### 代码签名

当前安装包未签名。

- **macOS**：需要 Apple Developer ID Application 证书。把证书导出为 p12，在 CI 里设置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`。公证再设置 `APPLE_ID`、`APPLE_PASSWORD`（app 专用密码）、`APPLE_TEAM_ID`。Tauri 在这些变量存在时会签名并公证。说明见 https://v2.tauri.app/distribute/sign/macos/ 。
- **Windows**：Authenticode 用自己的代码签名证书。在 `tauri.conf.json` 的 `bundle.windows.certificateThumbprint` 填证书指纹，或设置 `bundle.windows.signCommand` 调用 `signtool`。时间戳服务器用证书颁发机构提供的 URL。说明见 https://v2.tauri.app/distribute/sign/windows/ 。`TAURI_SIGNING_PRIVATE_KEY` 只用于 Tauri 更新器，不是安装包签名。

阶段二测到的安装包和还没在本机跑起来的平台，见 [docs/phase2-report.md](docs/phase2-report.md)。

## Android

壳是 Capacitor 8，工程在 `android/`。应用 id 是 `com.xinyao.cadviewer`，桌面名称是「鑫垚CAD看图」，`minSdk` 是 26（WebView 需要能跑 WebGL2 和 WASM）。页面、worker、LibreDWG wasm 和字体都打进 APK，不访问网络。系统「打开」和「分享」进来的 `content://` 会先复制到应用缓存，再交给 `window.openCadFile`。微信、QQ 和文件管理器经常把 DWG/DXF 标成 `application/octet-stream`，原生层按文件名后缀判断，不是图纸就丢掉。

手机上双指缩放、单指平移。测量时长按约半秒：十字光标在指尖上方，旁边有放大镜，对象捕捉半径比桌面更大。单张图纸超过 96 MB 会提示内存不够，不会硬撑到 WebView 崩溃。PNG 和 PDF 走系统分享面板，可以保存或发给其他应用。

```bash
npm install
npm run android:build
```

产物：

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

调试包（模拟器或 `adb install`）用 `cd android && ./gradlew assembleDebug`。

### Android 签名

仓库里的 `android/xinyao-test.keystore` 是公开测试证书，口令和别名都是 `xinyao` / `xinyao-test`。谁都可以用同一把钥匙签出能安装的包，所以不能拿它上架，也不能当成身份。CI 在没有下面这些 Secrets 时用这把钥匙，这样 Release 上的 APK 可以直接安装。

换成自己的上传密钥时，在仓库 Settings → Secrets and variables → Actions 添加：

| Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 your-upload.keystore` 的输出 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 口令 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 密钥口令 |

设齐之后，`.github/workflows/mobile.yml` 会用这把钥匙签 release APK 和 AAB，不再用测试证书。本地覆盖则设置同名环境变量，`ANDROID_KEYSTORE_PATH` 指向 keystore 文件。

## HarmonyOS NEXT

工程在 `harmony/`，stage 模型，ArkTS。`deviceTypes` 包含 phone、tablet、2in1，窗口里是一块铺满的 ArkWeb。页面从 `https://xinyao.local/` 加载，`WebSchemeHandler` 把这个地址映射到 `resources/rawfile/www`，`.wasm` 用 `application/wasm`，worker 脚本用 `text/javascript`，这样离线也能创建 Worker 和编译 WASM。WebGL2 依赖系统 ArkWeb，工程按这个前提写，没有在真机上核实。

「打开」用 `DocumentViewPicker`，只列出 `.dwg` / `.dxf`。「打开方式」靠 `utd.json5` 里声明的 `com.xinyao.cadviewer.dwg` 和 `.dxf`。字节留在原生侧，页面再 `fetch('https://xinyao.local/inbox/…')` 取走，避免把整张图纸塞进一段 JavaScript 字符串。超过 96 MB 会弹出中文提示。

网页资源不进 git。打包前执行：

```bash
npm install
npm run harmony:sync
```

然后用 DevEco Studio 打开 `harmony/` 目录。

### 签名和安装

HAP 必须用华为开发者证书签名才能装到真机。测试可以在 DevEco 里自动签名，不需要先准备发布证书。

自动签名（真机调试够用）：

1. 安装 DevEco Studio（带 HarmonyOS NEXT SDK 和 hvigor）。
2. 用华为账号登录。File → Project Structure → Signing Configs，勾选 Automatically generate signature，选一个调试设备。
3. DevEco 会把证书路径写进 `harmony/build-profile.json5`。不要把生成的 `.p12`、口令提交进仓库。
4. Run 到手机、平板或 2in1。

自己的发布证书（上架或给别人安装）：

1. 注册华为开发者账号，并完成实名。
2. 在 AppGallery Connect 创建应用，包名填 `com.xinyao.cadviewer`。
3. 申请发布证书和 Profile，下载三个文件：密钥库 `.p12`、证书 `.cer`、Profile `.p7b`。
4. 把三个文件放进 `harmony/signing/`（这个目录里的证书已在 `.gitignore`）。
5. 复制 `harmony/signing/local.example.json` 为 `harmony/signing/local.json`，填入口令、别名和上面三个文件的相对路径。
6. 运行 `node scripts/apply-harmony-signing.mjs`。它把 `signingConfigs` 写进 `harmony/build-profile.json5`。
7. 在 DevEco 里 Build → Build Hap(s)/APP(s)，或在装好 command line tools 的机器上，于 `harmony/` 目录执行 `ohpm install` 然后 `hvigorw assembleHap`。

命令行工具没有随这个仓库下载成功时，不要假设 CI 能打出 HAP。现阶段没有 HarmonyOS 的 GitHub Actions 作业。详情和没在设备上跑过的部分见 [docs/phase3-report.md](docs/phase3-report.md)。

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
  shell/                  window.openCadFile；Tauri、Android、HarmonyOS 各自读文件
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

1. **Tauri 2（macOS / Windows）**：桌面壳已接上。还要在真正的 WebView2 和 WKWebView 上跑一遍安装包，并补上签名。
2. **Capacitor（Android）**：已接上。系统选择器、「打开方式」和分享导出都走 `openCadFile`。发布证书还要换成你自己的上传密钥。
3. **HarmonyOS NEXT（手机 / 平板 / 2in1）**：ArkTS 工程已能在 DevEco 里打开。ArkWeb 用自定义 scheme 提供 wasm 和 worker。真机签名和运行还要你本机的开发者证书。
4. **解析器**：复杂或较新的 DWG 可换成商业库，只替换 `src/dwg/active.ts`。
5. 图纸空间视口、SHX 大字体的字形宽度、以及把测量写回文件，留到后续阶段。

阶段一实际测到的结果、做不到的事和体积，见 [docs/phase1-report.md](docs/phase1-report.md)。
