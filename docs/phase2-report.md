# 阶段二报告

日期：2026-11-01。桌面壳是 Tauri 2，包名 `XinyaoCADViewer`，窗口标题和关于对话框是「鑫垚CAD看图」。安装包和可执行文件名保持 ASCII，因为从 Linux 交叉编译时，Windows 版本信息资源编译器会拒绝非 ASCII 的产品名。

## 实际打出来的安装包

| 文件 | 大小 | 在哪打的 | 有没有在本机运行 |
| --- | --- | --- | --- |
| `XinyaoCADViewer_0.2.0_x64-setup.exe` | 6.6 MB | 本机 Linux，`cargo-xwin` + NSIS，目标 `x86_64-pc-windows-msvc` | 没有。这台机器没有 WebView2。`file` 确认安装包是 NSIS 自解压包，里面的 `xinyao-cad-viewer.exe` 是 PE32+ x86-64 |
| `XinyaoCADViewer_0.2.0_amd64.deb` | 8.5 MB | 本机 Linux，WebKitGTK 4.1 | 有。解压后的 `.desktop` 含 `Exec=xinyao-cad-viewer %u` 和 DWG/DXF 的 MimeType |

没有打出 macOS `.dmg`，也没有打出 Windows `.msi`。MSI 依赖 WiX，只能在 Windows 上做。DMG 和 WKWebView 只能在 macOS 上做。`.github/workflows/desktop.yml` 会在 GitHub 的 `windows-latest` 上打 NSIS 和 MSI，在 `macos-latest` 上打 universal DMG。

Origin 的云代理目前是 Linux。要得到 DMG，需要一台 macOS 构建机（GitHub 托管的 `macos-latest`，或自备的 Mac）。只在 Linux 上不能代替 WKWebView 的运行验证。

两个安装包都未签名。签名步骤写在 README 的「代码签名」。

## 在 Linux 桌面壳上验证过的

发布版二进制通过 `tauri://localhost` 加载内嵌资源，不连开发服务器：

- `workers/libredwg-parser-worker.js` → 200 `text/javascript`
- `workers/libredwg-web.wasm` → 200 `application/wasm`
- `workers/mtext-renderer-worker.js` → 200 `text/javascript`
- `cad-data/fonts/fonts.json` → 200 `application/json`
- `cad-data/fonts/NotoSansSC-Regular.otf` → 200 `application/font-sfnt`
- WebGL：`webgl ok WebKit WebGL`，原点是 `tauri://localhost`
- 命令行传入 `measure-fixture.dxf` 后打开成功（37326 字节），画面里有中文「测量基准 100」和图线
- 已经运行时再启动第二个进程并传入 `measure-fixture.dwg`，第二个进程退出，第一个窗口打开该 DWG，状态栏文件名变成 `measure-fixture.dwg`
- 关于对话框在窗口里可见。NSIS 脚本包含 GPL-3.0 许可页（`MUI_PAGE_LICENSE`），以及 `.dwg` / `.dxf` 关联：`"xinyao-cad-viewer.exe" "%1"`

这是 WebKitGTK，不是 Windows WebView2，也不是 macOS WKWebView。Tauri 2 在这三个平台都用同一套 `tauri://localhost` 资源协议，MIME 和 worker 的行为仍应在对应系统上再确认一次。

## 壳做了什么

- 原生打开对话框和 PNG/PDF 保存对话框（`tauri-plugin-dialog`）。无头测试里没有点这些对话框。
- 单实例（`tauri-plugin-single-instance`）。Linux 上用 D-Bus 验证过第二次打开文件。
- 命令行参数、`file://` URL，以及 macOS 的 `RunEvent::Opened`（这段只在 macOS 编译）。
- 读文件的命令只接受 `.dwg` / `.dxf`，最大 512 MB。写出只接受 `.png` / `.pdf`。
- 窗口标题「鑫垚CAD看图」。关于对话框说明 GPL-3.0-only、LibreDWG、MIT 核心和 OFL 字体。

## 还没做或还没测

- 没有在 WebView2 或 WKWebView 里打开过图纸。交叉编译出的 exe 不能在这台 Linux 上运行。
- 没有 MSI，没有 DMG，没有签名，没有公证。
- 原生文件对话框和拖进窗口只写了代码，没有在测试里点过。
- 安装包文件名和开始菜单名是 `XinyaoCADViewer`。若要安装向导也显示「鑫垚CAD看图」，需要在 Windows 本机用 MSVC 的资源编译器再打一版，并确认 NSIS 的 Unicode 语言包。
- 图纸空间视口、SHX 字宽、把测量写回文件，仍是阶段一留下的限制。

## 接下来怎么拿到 macOS 和 MSI

在有 GitHub Actions 的仓库里运行 `.github/workflows/desktop.yml`（手动触发，或推送 `v*` 标签）。需要：

- Windows 托管 runner：打 NSIS 和 MSI
- macOS 托管 runner（Apple Silicon 即可交叉出 universal）：打 DMG
- 若要签名：按 README 配 Apple Developer ID 和 Windows 证书，不要把 p12 或私钥提交进仓库
