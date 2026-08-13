# 新酒馆

[English](readme.md) | **简体中文** | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | [Español](readme-es_es.md)

新酒馆是基于 SillyTavern `1.18.0` 的多用户 AI 角色聊天工作区。项目保留 SillyTavern 的聊天内核、角色卡、世界书、预设、Persona、API 连接与扩展系统，并在其上提供重新设计的桌面端与移动端界面。

> **最新更新：2026-08-13**  
> 新 UI、日间/夜间主题、液态玻璃界面、Horae 集成与“外置手机”全局悬浮适配已经发布。查看[完整更新日志](../CHANGELOG_NEW_UI.md)。

## 主要功能

- 消息、角色卡、预设、世界书、插件和“我的”六个一级页面。
- 微信式单列角色列表，以及角色、故事线和聊天状态的统一管理。
- 每条故事线可恢复独立的模型、预设、API 地址与 Connection Profile。
- Persona 继承沿用 SillyTavern：故事线设定优先于角色绑定，角色绑定优先于全局 Persona。
- 多用户注册与登录；不同用户的角色卡、聊天、世界书、预设、Persona 和 API Key 相互隔离。
- 日间/夜间主题、响应式移动布局和统一的液态玻璃视觉。
- 保留 SillyTavern 原有 DOM、事件、数据格式和扩展接口，尽量兼容现有插件。
- 集成时光记忆 Horae，并适配“外置手机”等全局悬浮工具。

## 安装与启动

1. 安装 Node.js 20 或更高版本。
2. 在项目目录运行 `npm install`。
3. Windows 双击 `Start.bat`；其他平台运行 `npm start`。
4. 默认访问地址为 `http://127.0.0.1:8000/`。

首次注册的账号会成为管理员，之后注册的账号为普通用户。公开仓库不包含任何本地用户数据、聊天记录、角色卡、API Key 或个人配置。

## 兼容与后续计划

新 UI 通过独立壳层调用 SillyTavern 的原生控件和事件，聊天、角色、预设与插件数据仍使用原格式。真正的跨故事线服务端并发，以及关闭浏览器后继续生成，仍需继续迁移到服务端任务队列。

## 许可与致谢

本项目基于 [SillyTavern](https://github.com/SillyTavern/SillyTavern)，继承 GNU AGPL-3.0 许可。感谢 SillyTavern 与所有相关扩展的开发者和贡献者。
