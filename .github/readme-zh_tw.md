# 新酒館

[English](readme.md) | [简体中文](readme-zh_cn.md) | **繁體中文** | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | [Español](readme-es_es.md)

新酒館是以 SillyTavern `1.18.0` 為基礎的多使用者 AI 角色聊天工作區。專案保留 SillyTavern 的聊天核心、角色卡、世界書、預設、Persona、API 連線與擴充系統，並提供重新設計的桌面與行動介面。

> **最新更新：2026-08-13**  
> 新 UI、日間與夜間主題、液態玻璃介面、Horae 整合，以及「外置手機」全域懸浮適配已經發布。查看[完整更新日誌](../CHANGELOG_NEW_UI.md)。

## 主要功能

- 訊息、角色卡、預設、世界書、插件與「我的」六個根頁面。
- 類似通訊軟體的單欄角色清單，統一管理角色、故事線與聊天狀態。
- 每條故事線可還原獨立的模型、預設、API 位址與 Connection Profile。
- 沿用 SillyTavern Persona 繼承：故事線設定優先於角色綁定，角色綁定優先於全域 Persona。
- 開放使用者名稱與密碼註冊，且每位使用者的角色、聊天、世界書、預設、Persona 與 API Key 完全隔離。
- 日間與夜間主題、響應式行動版面，以及統一的液態玻璃視覺。
- 保留 SillyTavern 的 DOM 事件、資料格式與擴充 API，以維持插件相容性。
- 整合時光記憶 Horae，並支援「外置手機」等全域懸浮工具。

## 安裝與啟動

1. 安裝 Node.js 20 或更新版本。
2. 在專案目錄執行 `npm install`。
3. Windows 雙擊 `Start.bat`；其他平台執行 `npm start`。
4. 預設開啟 `http://127.0.0.1:8000/`。

第一個註冊帳號會成為管理員，之後的帳號為一般使用者。公開倉庫不包含本機使用者資料、聊天記錄、角色卡、API Key 或個人設定。

## 相容性與後續計畫

新 UI 透過獨立外殼呼叫 SillyTavern 原有控制項與事件，聊天、角色、預設及插件資料仍使用原始格式。真正的跨故事線伺服器端並行生成，以及關閉瀏覽器後繼續生成，仍需要遷移至伺服器任務佇列。

## 授權與致謝

本專案以 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 為基礎，依 GNU AGPL-3.0 授權發布。感謝 SillyTavern 社群與相關擴充的開發者。
