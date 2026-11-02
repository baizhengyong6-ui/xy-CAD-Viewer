# 阶段三报告

日期：2026-11-01。这一阶段给同一套静态 Web 核心加了 Android（Capacitor）和 HarmonyOS NEXT（ArkTS / ArkWeb）外壳，并把各端版本号对齐到 **0.3.0**。

版本号现在来自 `package.json`，并写进：

- `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`（安装包文件名里的版本）
- Android `versionName "0.3.0"`、`versionCode 3`
- HarmonyOS `AppScope/app.json5` 的 `versionName` / `versionCode`，以及 `harmony/entry/oh-package.json5`

`npm test` 里的 `scripts/version.sync.test.ts` 会核对这几处。0.2.1 的 Release 标题和安装包文件名仍写着 0.2.0，是因为当时只改了 Git 标签、没有改应用版本。0.3.0 起这几处是同一个数。本报告没有打 `v0.3.0` 标签，也没有合并到 `main`。

## Android

工程在 `android/`，应用 id `com.xinyao.cadviewer`，显示名「鑫垚CAD看图」，`minSdk` 26。页面、worker、`libredwg-web.wasm` 和 Noto 字体都打进 APK，Capacitor 对 `.wasm` 使用 `application/wasm`。

打开文件有两条路：

- 应用内「打开」走 `ACTION_OPEN_DOCUMENT`。
- 「用其他应用打开」和分享走 `ACTION_VIEW` / `ACTION_SEND`。`content://` 先复制到缓存，再交给 `window.openCadFile`。微信、QQ、文件管理器经常给 `application/octet-stream` 或 `*/*`，原生层用显示名后缀判断；MIME 里能看出 dwg/dxf 时也会补后缀。不是图纸就丢掉。

超过 96 MB 会提示内存不够。测量沿用查看器内核：双指缩放、单指平移，长按约半秒后十字光标在指尖上方并带放大镜。触屏上把对象捕捉孔径提高到 36 CSS 像素。PNG / PDF 用系统分享面板。

签名用仓库里的公开测试证书 `android/xinyao-test.keystore`（别名 `xinyao`，口令 `xinyao-test`）。它只为了让 APK 能安装，不能当发布身份。换成自己的上传密钥见 README「Android 签名」。`.github/workflows/mobile.yml` 在 `main` 和 `v*` 标签上打 release APK 与 AAB；标签推送时把 APK 挂到 GitHub Release。

### 在这台机器上打出来的包

| 文件 | 大小 | 签名 |
| --- | --- | --- |
| `XinyaoCADViewer-0.3.0-release.apk` | 9,285,375 字节（8.86 MiB） | 测试证书 `CN=Xinyao CAD Viewer Test` |
| `XinyaoCADViewer-0.3.0-release.aab` | 9,147,213 字节（8.72 MiB） | 同一把测试证书 |

APK 里能列出 `assets/public/workers/libredwg-web.wasm`、两个 worker、`NotoSansSC-Regular.otf` 和示例 DWG/DXF。本机产物副本：

- `/opt/cursor/artifacts/XinyaoCADViewer-0.3.0-release.apk`
- `/opt/cursor/artifacts/XinyaoCADViewer-0.3.0-release.aab`

### 模拟器

这台云主机有 `/dev/kvm`，但嵌套虚拟化在创建 vCPU 时触发内核错误（`kvm_spurious_fault` / `vmx_vcpu_create`），硬件加速起不来。改用 `-accel off` 之后，API 34 模拟器大约十分钟完成启动，debug APK 也安装成功，进程 `com.xinyao.cadviewer` 能起来。

没有完成「打开示例 DWG/DXF 并测量」的截图。软件渲染下 `screencap` 一直是全黑；WebView 的渲染进程随后崩溃，系统日志是 `Render process's crash wasn't handled by all associated webviews`。DevTools 能看到 `https://localhost/`，但调试命令没有返回页面内容。所以不能把这次模拟器运行说成看图或测量已通过。需要在真机或一台嵌套虚拟化正常的模拟器上再确认一次。

## HarmonyOS NEXT

工程在 `harmony/`，stage 模型，`deviceTypes` 为 phone、tablet、2in1。ArkWeb 加载 `https://xinyao.local/index.html`。`WebSchemeHandler` 把这个源映射到 `rawfile/www`，`.wasm` 为 `application/wasm`，worker 为 `text/javascript`。图纸字节留在原生侧，页面 `fetch('https://xinyao.local/inbox/…')` 再交给 `openCadFile`，避免把整文件塞进 `runJavaScript` 字符串。

「打开」是 `DocumentViewPicker`（后缀 `.dwg` / `.dxf`）。「打开方式」在 `rawfile/arkdata/utd/utd.json5` 声明了 `com.xinyao.cadviewer.dwg` 和 `.dxf`。超过 96 MB 弹中文对话框。导出走 `ohos.want.action.sendData`。

网页资源不进 git。`npm run harmony:sync` 把 `dist/` 拷到 `harmony/entry/src/main/resources/rawfile/www`。

### 没有打出 HAP，也没有上设备

华为 Command Line Tools 的完整包（含 SDK、`hvigorw`、`ohpm`）在开发者联盟下载中心，这次没有拿到可直接解压的官方整包。华为云镜像上的 `command-line-tools.zip` 只有 hvigor 脚本，没有 HarmonyOS SDK，不能 `assembleHap`。因此：

- 没有 HAP 文件，没有设备安装，没有截图。
- 没有加 HarmonyOS 的 GitHub Actions 作业。加一个每次都因缺少 SDK 失败的作业没有用。
- ArkWeb 的 scheme 拦截、WebGL2、worker 和 wasm 是按公开的 API 12 文档写的，没有用 DevEco 编译过。若 SDK 的类名或 `WebNetErrorList` 枚举和文档不一致，需要在 DevEco 里改 `harmony/entry/src/main/ets/pages/Index.ets` 的那一层。

签名步骤写在 README「HarmonyOS NEXT」。调试用 DevEco 自动签名即可；给别人安装需要华为开发者账号，以及 `.p12`、`.cer`、`.p7b`。`node scripts/apply-harmony-signing.mjs` 把 `harmony/signing/local.json` 写进 `build-profile.json5`。证书不要提交。

## 还没做

- 没有在真机上打开过图纸，没有测量截图，没有分享面板的点击记录。
- 没有 HAP。
- 没有把 `v0.3.0` 推到 GitHub。合并并得到同意之后再打标签，Android 工作流才会把 APK 挂到 Release。
- 桌面端 Tauri 的版本号已经改成 0.3.0，但这次没有重新打 DMG / NSIS / MSI。
