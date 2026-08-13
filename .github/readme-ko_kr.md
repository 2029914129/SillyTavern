# New Tavern (신주점)

[English](readme.md) | [简体中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | **한국어** | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | [Español](readme-es_es.md)

New Tavern은 SillyTavern `1.18.0`을 기반으로 만든 다중 사용자 AI 캐릭터 채팅 작업 공간입니다. SillyTavern의 채팅 엔진, 캐릭터 카드, 로어북, 프리셋, Persona, API 연결 및 확장 시스템을 유지하면서 데스크톱과 모바일 UI를 새롭게 설계했습니다.

> **최신 업데이트: 2026년 8월 13일**  
> 새 UI, 라이트/다크 테마, 리퀴드 글라스 디자인, Horae 통합 및 External Phone 전역 플로팅 지원이 공개되었습니다. [전체 변경 기록](../CHANGELOG_NEW_UI.md)을 확인하세요.

## 주요 기능

- 메시지, 캐릭터, 프리셋, 로어북, 확장, 프로필의 6개 루트 페이지.
- 캐릭터, 스토리라인 및 채팅 상태를 함께 관리하는 단일 열 대화 목록.
- 스토리라인별 모델, 프리셋, API 주소 및 Connection Profile 복원.
- SillyTavern Persona 상속 유지: 스토리라인 설정이 캐릭터 연결보다 우선하며, 캐릭터 연결은 전역 Persona보다 우선합니다.
- 사용자 이름과 비밀번호 등록을 지원하며 캐릭터, 채팅, 로어북, 프리셋, Persona 및 API Key를 사용자별로 격리합니다.
- 라이트/다크 테마, 반응형 모바일 레이아웃, 일관된 리퀴드 글라스 UI.
- SillyTavern의 DOM 이벤트, 데이터 형식 및 확장 API를 유지하여 기존 플러그인과의 호환성을 중시합니다.
- Horae 통합 및 External Phone 같은 전역 플로팅 도구 지원.

## 설치 및 실행

1. Node.js 20 이상을 설치합니다.
2. 프로젝트 폴더에서 `npm install`을 실행합니다.
3. Windows에서는 `Start.bat`, 다른 플랫폼에서는 `npm start`를 실행합니다.
4. 기본 주소는 `http://127.0.0.1:8000/`입니다.

첫 번째로 등록한 계정은 관리자가 되고 이후 계정은 일반 사용자가 됩니다. 공개 저장소에는 로컬 사용자 데이터, 대화, 캐릭터 카드, API Key 또는 개인 설정이 포함되지 않습니다.

## 호환성과 향후 계획

새 UI는 독립 셸에서 SillyTavern의 기존 컨트롤과 이벤트를 사용합니다. 채팅, 캐릭터, 프리셋 및 확장 데이터는 원래 형식을 유지합니다. 브라우저를 닫은 뒤에도 계속되는 다중 스토리라인 서버 병렬 생성은 향후 서버 작업 큐로 이전해야 합니다.

## 라이선스 및 감사

이 프로젝트는 [SillyTavern](https://github.com/SillyTavern/SillyTavern)을 기반으로 하며 GNU AGPL-3.0 라이선스로 배포됩니다. SillyTavern 커뮤니티와 확장 개발자 여러분께 감사드립니다.
