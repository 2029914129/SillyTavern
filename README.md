# 新酒馆移动端

这是“新酒馆”定制版 SillyTavern 的 Android 移动端源码。

应用目标是在 Android APK 内嵌 Node.js 和 SillyTavern，用户不需要安装
Termux、Git 或 Node.js，也不需要在手机上执行命令。启动应用后，本地服务监听
`127.0.0.1`，再由应用内置 WebView 打开酒馆界面。

## 当前版本

- 应用名称：新酒馆
- 应用包名：`com.newsillytavern.mobile`
- 最低系统：Android 9 / API 28
- ABI：`arm64-v8a`
- SillyTavern：1.18.0 定制版
- Node.js：24.18.0
- 当前测试包：`0.1.0-test7`
- 本地端口：`127.0.0.1:51821`

## 目录

- `android/`：生成 test7 APK 所使用的 Android/Kotlin 源码。
- `sillytavern/`：APK 中 SillyTavern 程序资源对应的源码快照，包含移动端补丁、
  定制 UI 和当前插件源码。
- `node-build/`：Node.js Android arm64 构建脚本和补丁。
- `packaging/`：移动端启动入口相关源码。
- `tests/`：现有运行时冒烟测试。
- `docs/`：现有架构分析文档。

## 未提交的文件

源码仓库不包含以下生成物和本地数据：

- `node_modules`
- Android `build`、`.gradle` 缓存
- `libnode.so`、`libc++_shared.so`
- `st_bundle.tar`
- APK/AAB
- 聊天、角色、API Key、Cookie、日志和其他用户数据

这些文件不是业务源码。`libnode.so`、`st_bundle.tar` 和 APK 单文件过大，
应作为构建产物或 GitHub Release 附件保存，不应放进普通 Git 源码历史。

## 当前测试状态

test7 已验证本地 HTTP 服务、SillyTavern 1.18.0 页面、定制 UI、`uiReady` 和
Horae 基础加载。真实 ARM64 手机上的长期稳定运行、流式响应、WebSocket 和
Horae IndexedDB 完整备份仍需继续测试。

## 许可证

本项目包含 SillyTavern 和 ST-android 衍生代码，保留 AGPL-3.0 许可证。
Node.js 使用 MIT 许可证，Node Android 补丁保留原 MIT 声明。

本项目不是 SillyTavern 官方项目。

当前 Horae 1.15.1 源码快照中未找到明确 LICENSE 文件。公开发布包含 Horae
的源码或 APK 前，建议先向作者确认授权。

## GitHub 仓库信息

- 推荐仓库名：`new-sillytavern-android`
- 推荐描述：`新酒馆 Android 客户端，内嵌 Node.js 24.18.0 与定制 SillyTavern 1.18.0，无需 Termux。`
- 推荐 Topics：`sillytavern`、`android`、`nodejs`、`webview`、`kotlin`、`arm64`

APK 请放在 GitHub Releases，不要提交到源码目录。

