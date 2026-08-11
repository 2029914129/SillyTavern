# 新酒馆 Android 第一阶段架构验证

日期：2026-08-10

状态：架构验证完成；尚未创建 Android 工程，尚未修改“新酒馆”源码。

## 1. 结论

推荐继续采用“原生 Android 外壳 + APK 内嵌 Node.js + 固定版本 SillyTavern 资源 + 应用内 WebView”，但不能直接复制参考启动器。

- 当前定制版是 SillyTavern 1.18.0，要求 Node.js >=20。
- 参考项目内嵌 Node.js 18.20.4，打包 SillyTavern 1.16.0，且已经归档。
- 官方 Node.js Mobile 当前公开 Android 核心版本仍为 Node.js 18.20.4，不满足要求。
- 当前依赖树没有发现 .node 原生扩展。主要风险是 Android Node 版本、进程/文件系统、WASM、内存和插件。
- 推荐采用仍在维护的 Android Node 构建补丁链，构建 Node.js 24.18.0 的 libnode.so，由本项目自行维护 Kotlin/JNI 外壳。
- Node 应运行在独立 Android 进程。Activity/WebView 与 Node 生命周期分离，重试时重建 Node 进程。
- 第一版不实现应用内更新，运行时不执行 Git 或 npm。

## 2. 当前定制版

### 版本

- SillyTavern：1.18.0
- Git 基线：8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8
- package.json Node 要求：>=20
- 当前 Windows 环境：Node 24.18.1、npm 11.16.0
- npm lockfile v3
- 许可证：AGPL-3.0

工作树中存在定制 UI、登录页、用户接口、启动流程和 Horae 适配的未提交改动。Android 打包输入必须从受控快照生成，不能在构建时临时 git pull。

### 移动端 UI 核验

已经具备：

- viewport-fit=cover
- interactive-widget=resizes-content
- safe-area inset
- 360/410/520/700/760/768px 等断点
- 横屏低高度规则
- prefers-reduced-motion
- backdrop-filter 不支持时的降级
- Horae 手机面板适配

仍需第二阶段真机修正：

- 大量 fixed 定位和多层 backdrop-filter，低端 GPU 可能掉帧。
- Horae 面板最高约 22px 模糊，需要设备能力或用户设置降级。
- 需要测试 320/360/393/412/600dp、横屏、字体 1.3x/1.5x、刘海和系统导航。
- 需要验证软键盘打开时输入框、底部导航和抽屉不遮挡。
- 当前环境没有可用的交互浏览器实例。本阶段完成静态 CSS/DOM 检查和本地 HTTP 启动检查，未完成截图级视觉验收。

判断：UI 可以作为移动端候选，不需要推倒重做；第二阶段必须做真机性能和遮挡修正。

## 3. 依赖兼容性

### 纯 JavaScript

大多数生产依赖为纯 JavaScript，包括 Express、中间件、归档、解析、代理和模板相关包。代表包：

- express、body-parser、compression、cookie-parser、cookie-session
- cors、helmet、multer、ws
- archiver、yauzl、yaml、lodash、handlebars
- node-fetch、proxy-agent、isomorphic-git

### 使用 Node 内置模块或系统行为

SillyTavern 核心及下列功能依赖 fs、path、http/https、net、dns、crypto、stream、worker_threads、child_process 或进程环境：

- simple-git
- command-exists
- open
- is-docker
- write-file-atomic
- node-persist
- proxy-agent
- webpack

Android 版将禁用自动打开浏览器、Git 拉取、扩展 Git 安装和运行期 npm，并禁止依赖 shell、bash、cmd.exe 或 Termux 路径。

### 原生扩展

扫描当前 node_modules：

- .node 文件数量：0
- 未发现必须提供 Android N-API/node-gyp 二进制的生产包。
- protobufjs 的 postinstall 是 JavaScript 脚本，不是原生编译。

这说明当前没有明显原生 addon 阻断项，但生产依赖仍必须在受控构建环境重新生成，不能复制 Windows node_modules。

### WebAssembly

发现 21 个 WASM 文件，主要来自：

- tiktoken
- onnxruntime-web
- sillytavern-transformers
- @jsquash 的 AVIF/JPEG/PNG/WebP/OxiPNG

ONNX、WASM SIMD/threads 和图片编解码会增加内存峰值。低内存设备应允许禁用本地 transformers/向量模型等非关键能力。

### 可降级功能

- open：Android 外壳不使用。
- simple-git、command-exists：首版关闭运行期 Git 功能。
- 本地 transformers/ONNX：不阻塞主页面。
- 插件在线安装/更新：首版禁用，或以后改成校验过的受控导入包。

## 4. 插件和 Horae

已安装第三方扩展：

- JS-Slash-Runner / 酒馆助手 4.9.1
- LittleWhiteBox 3.0.4
- SillyTavern-Horae 1.15.1

Horae 现状：

- 设置写入 SillyTavern extension_settings。
- 向量数据写入 WebView IndexedDB，数据库名 HoraeVectors。
- 使用 Web Worker。
- 本地向量模式动态加载 jsDelivr 上的 @huggingface/transformers@3，并下载模型。
- 调用 SillyTavern API 和用户配置的外部 API。

风险与措施：

- WebView 数据目录必须稳定，升级时不能清空 Cookie、LocalStorage、IndexedDB。
- HoraeVectors 必须纳入备份；只备份 SillyTavern data 目录不够。
- 离线首次使用时远程 transformers 和模型不可用，该功能不能阻塞主页面。
- CSP、跨域、Worker、WASM 和加载顺序需 ARM64 真机测试。

酒馆助手和 LittleWhiteBox 仓库中保留了大量构建依赖。移动发布包只打运行产物，不把 Vite、TypeScript、Sass、测试依赖作为运行依赖。LittleWhiteBox 的 server-plugin 需要单独验证 Node API、文件路径和数据保存。

## 5. 参考启动器评估

参考项目：al01cn/sillytavern-launcher-mobile

1. 技术栈：Java + AppCompat + XML、JNI/C++、CMake/NDK、WebView、7z。
2. Node 嵌入：JNI 调用 node::Start()；内嵌 Node 18.20.4，ABI 108。
3. 资源：assets/sillytavern.7z 首次解压到 filesDir/SillyTavern。
4. npm：启动时没有 npm install；依赖应包含在 7z，但没有可复现的 Android 依赖流水线。
5. 启停：按钮启动 Node 线程；没有可靠单实例状态机，onDestroy 不停止 Node。
6. 就绪：读取 logcat 匹配英文日志，再固定 sleep 800ms；没有真实 HTTP 健康检查或 UI ready。
7. 数据：程序和数据混放在 filesDir/SillyTavern。
8. 升级：缺少资源 manifest、哈希、原子切换、数据 schema 和回滚。
9. 兼容：SillyTavern 1.16.0 + Node 18.20.4，不兼容当前 1.18.0 + Node >=20。
10. 许可证：启动器 MIT；复用时保留版权和 MIT 文本。SillyTavern 仍受 AGPL-3.0 约束。

参考项目还有以下不应复用的 WebView 设置：

- file URL universal access
- mixed content always allow
- 所有 URL 留在 WebView
- Release WebView debugging
- 权限较大的 JavaScript Bridge

其 7z 还被整包读入内存，500MB 级资源存在 OOM 风险。

## 6. Node.js Mobile 和替代方案

官方 Node.js Mobile 的嵌入模型可参考，但当前公开 Android 核心版本为 Node 18.20.4，不能作为现成运行时使用。

推荐采用 Sanitised/ST-android 使用的 Node Android 补丁链作为构建参考：

- 当前 Node fork 基线是 Node.js 24.18.0。
- 已用于 Android ARM64 本地运行 SillyTavern。
- 只复用或重建 Node Android 运行时和必要补丁，不复用其首次安装 npm、外部浏览器等产品流程。

第二阶段第一项技术闸门：

1. 构建 arm64-v8a libnode.so。
2. 在最小 Android App 运行 Node 24.18.0。
3. 加载当前生产依赖。
4. 启动当前 SillyTavern 快照。
5. 完成 HTTP 200、WebSocket、流式响应和文件读写冒烟测试。

闸门通过后再扩展完整外壳。

## 7. 推荐 Android 架构

模块：

- app：Kotlin Activity、启动 UI、WebView、文件选择、下载、返回键。
- runtime-node：JNI、每 ABI 的 libnode.so、NodeRuntimeService。
- runtime-contract：Binder/Messenger 状态和日志协议。
- packaging：生成生产资源包、manifest、哈希和许可证。

进程：

- 主进程：Activity + WebView。
- :node 私有进程：NodeRuntimeService + libnode。

独立进程可以隔离 Node 崩溃，并在重试时干净结束旧进程，避免同一进程多次 node::Start()。

后台策略：

- App 前台时保持 Node。
- 退后台后保留短宽限期。
- 没有活跃生成或用户明确保持运行时停止服务。
- 如以后支持长期后台生成，再引入带通知的前台服务并满足目标 SDK/商店规则。

## 8. 程序与数据目录

建议布局：

~~~text
filesDir/
  runtime/node/<runtimeVersion>/<abi>/
  app/releases/<resourceVersion>/
    server.js
    src/
    public/
    node_modules/
    plugins/
    config.base.yaml
    manifest.json
  app/current-version.json
  data/
    sillytavern/
    plugins/
    migration/
    backups/
  logs/
    node/
    launcher/
~~~

规则：

- app/releases 只读对待，可整体替换。
- data 永不随程序资源覆盖。
- SillyTavern 使用 --dataRoot 指向 filesDir/data/sillytavern。
- 可写插件数据放 data/plugins；随发行版提供的插件代码放版本化程序目录。
- 升级先解压到 staging，校验后原子切换版本。
- 迁移前备份，失败时继续使用旧程序和旧数据。
- WebView 使用稳定包名和默认私有 profile，以保留 HoraeVectors 等 IndexedDB。

## 9. Git 和 npm

构建期：

- 固定 SillyTavern commit/内容哈希。
- 在受控 Linux 构建环境执行 npm ci --omit=dev。
- 运行 Android Node 兼容测试。
- 删除缓存、测试和开发依赖。
- 生成资源 manifest、SHA-256 和第三方许可证。

首次启动：

- 校验空间。
- 流式解压到 staging，不把整包读入内存。
- 校验哈希并创建数据目录。
- 原子切换 current resource version。
- 不执行 Git/npm。

每次启动：

- 读取 manifest 和迁移状态。
- 检查关键文件、Node 服务状态和端口所有权。
- 启动或连接唯一 Node 实例。
- 不执行 Git/npm。

升级：

- 新程序资源释放到新版本目录。
- 用户数据原地保留。
- 执行带版本号、可回滚的数据迁移。
- 失败时回退旧程序版本。

## 10. 启动、健康检查和 WebView

状态机：

~~~text
IDLE
PREPARING_FILES
MIGRATING_DATA
STARTING_NODE
WAITING_HTTP
LOADING_WEBVIEW
WAITING_UI_READY
READY
FAILED
STOPPING
~~~

流程：

1. 原生启动页显示真实阶段和不确定进度。
2. Node 服务选择受控可用端口。
3. 参数显式指定 loopback、端口、dataRoot 和禁用浏览器启动。
4. Android Node 入口在导入 server.js 前订阅 SillyTavern SERVER_STARTED。
5. 收到结构化 Node ready 后，原生层对 127.0.0.1 发真实 HTTP 请求。
6. HTTP 成功后隐藏加载 WebView。
7. 定制前端核心初始化完成后，通过仅限本地 origin 的最小 Bridge 发送 uiReady。
8. 原生层再切换到 WebView。

重试必须取消旧协程、HTTP 轮询、Binder 回调和导航，并确认旧 Node 进程退出。崩溃重启使用有限时间窗预算。

WebView 基线：

- 只允许本 App 拥有的 127.0.0.1 端口和明确白名单。
- 外链交给系统浏览器。
- 禁用 file URL universal access 和 mixed-content 放宽。
- Release 关闭调试。
- Bridge 仅暴露 uiReady 和受控系统请求，并校验 origin。
- WebChromeClient.onShowFileChooser 接入 Photo Picker/SAF。
- 下载使用 MediaStore、SAF 或 DownloadManager。
- onRenderProcessGone 后销毁旧 WebView并显示恢复页。

## 11. 数据导入导出

备份至少包括：

- data/sillytavern
- 可写插件数据
- WebView Cookie/LocalStorage/IndexedDB 的受控导出
- HoraeVectors
- 应用设置和迁移元数据

Windows 导入和 Android 导出都使用 SAF。导入先进入 staging，校验 manifest、版本和路径穿越后再迁移。API Key 保持在私有目录，日志必须脱敏，不申请“管理所有文件”权限。

## 12. 第二阶段拟新增目录

~~~text
新酒馆移动端/
  README.md
  docs/
    phase-1-architecture-validation.md
    licenses.md
    data-layout.md
  android/
    app/
      src/main/java/<package>/
        MainActivity.kt
        startup/StartupCoordinator.kt
        node/NodeRuntimeService.kt
        web/TavernWebViewController.kt
        data/ResourceInstaller.kt
        data/MigrationManager.kt
        data/BackupManager.kt
        diagnostics/RedactingLogStore.kt
      src/main/cpp/
        CMakeLists.txt
        node_bridge.cpp
  runtime/
    patches/
    licenses/
  packaging/
    prepare-sillytavern.mjs
    audit-dependencies.mjs
    generate-manifest.mjs
    generate-licenses.mjs
  tests/
    runtime-smoke/
    android-instrumented/
~~~

不会修改或删除“新酒馆/Start.bat”。Android 专用配置和入口放在移动端工程或构建 staging。

## 13. 需要确认

1. 最低 Android 版本
   - 推荐：Android 9 / API 28
   - Android 7 / API 24 会显著增加 WebView、存储和测试成本。

2. 首版 ABI
   - 推荐：仅 arm64-v8a
   - 后续增加 x86_64 用于模拟器。
   - 不建议首版投入 armeabi-v7a。

3. 包名
   - 待确认。
   - 示例：com.yourbrand.newtavern
   - 发布后必须稳定，否则私有数据和 WebView profile 不能自然继承。

4. 应用名称
   - 待确认。
   - 当前暂称“新酒馆”。

## 14. 第一阶段判断

- 技术路线可行，但运行时必须升级到 Node 24 Android 构建。
- 当前依赖没有原生 Node addon 阻断项。
- 定制 UI 具备手机基础适配，不需重做；仍需真机性能和布局修正。
- Horae 有兼容基础；本地向量、IndexedDB 备份和远程模型是重点风险。
- 参考启动器只能作为概念验证和反例清单，不能作为直接代码基线。
- 第二阶段先完成 arm64 Node + 当前 SillyTavern 最小运行时闸门，再建设完整 App。

## 参考

- https://github.com/al01cn/sillytavern-launcher-mobile
- https://nodejs-mobile.github.io/
- https://github.com/nodejs-mobile/nodejs-mobile
- https://github.com/Sanitised/ST-android
- https://github.com/nodejs/node/tree/android
- https://developer.android.com/develop/background-work/services/fg-service-types
- https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges
