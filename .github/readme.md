<a name="readme-top"></a>

<div align="center">

中文 | [English](readme-Eng_cn.md) | [日本語](readme-ja_jp.md) 

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

# 新酒馆

新酒馆是一个基于 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 的社区 UI 改版，主要面向希望获得更简洁导航、更适合移动设备操作和更统一视觉体验的用户。

本项目保留 SillyTavern 的核心聊天、角色卡、预设、世界书和扩展能力，并重新设计了主要页面、导航结构、主题系统与常用操作流程。

> 本项目是非官方社区修改版，与 SillyTavern 官方团队无隶属关系，也不代表官方版本或官方支持渠道。

## 主要改动

- 重新设计消息、角色卡、预设、世界书、插件和用户设置等主要页面；
- 使用单列角色会话列表，优化角色选择和聊天切换体验；
- 增加适合深色与浅色模式的液态玻璃视觉效果；
- 重做底部导航栏，并加入按压、回弹和流体滑动反馈；
- 简化普通用户较少使用的高级入口，同时保留底层兼容能力；
- 重新整理预设和界面设置，将高级选项按类别折叠；
- 优化聊天输入栏菜单、工具面板、通知和加载页面；
- 适配 Horae 时光记忆插件的入口与面板样式；
- 改善手机窄屏、安全区域、软键盘和横竖屏体验；
- 提供柔和的黑夜模式和白天模式。

## 当前状态

当前版本基于 SillyTavern `1.18.0` 开发。项目仍处于持续测试阶段，部分第三方扩展可能因自身更新或界面结构变化而存在兼容问题。

发布版本前请自行备份角色卡、聊天记录、预设、世界书、Persona 和插件数据。

## 安装与启动

### Windows

1. 安装项目要求的 Node.js 版本和 Git。
2. 克隆本仓库。
3. 按照项目提供的启动脚本运行。
4. 服务启动完成后，在浏览器中打开本地页面。

具体环境要求和命令请参阅 [安装文档](docs/installation.md)。

## 与官方版本的关系

本项目修改自 SillyTavern，并保留其原有许可证和版权声明。SillyTavern 的官方文档、问题反馈和更新说明请访问官方仓库。

本仓库中的改版问题请提交到本项目的 Issues，不要将改版产生的问题直接反馈给 SillyTavern 官方维护者。

## 数据与隐私

本项目不会在仓库中提供任何用户 API Key、聊天记录、角色数据或私人配置。使用者应妥善保管自己的服务密钥，并在升级或迁移前备份数据。

## 第三方扩展

Horae、酒馆助手、LittleWhiteBox 等扩展由各自作者维护，并适用各自的许可证。本项目对相关扩展的说明仅代表兼容适配情况，不代表拥有或重新许可这些扩展。

## 许可证

本项目是 SillyTavern 的衍生版本，按照仓库中的 `LICENSE` 文件发布。第三方依赖、扩展、字体、图标和其他资源可能适用各自的许可证，请同时查阅相关版权说明。

## 致谢

感谢 SillyTavern 官方团队、社区贡献者以及相关扩展作者提供的开源项目和生态支持。
