# New Tavern

**English** | [简体中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | [Español](readme-es_es.md)

New Tavern is a multi-user AI character chat workspace based on SillyTavern `1.18.0`. It keeps the SillyTavern chat engine, characters, lorebooks, presets, Personas, API connections, and extension system while providing a redesigned desktop and mobile interface.

> **Latest update: August 13, 2026**  
> The new UI, light and dark themes, liquid-glass styling, Horae integration, and global overlay support for External Phone are now available. Read the [complete changelog](../CHANGELOG_NEW_UI.md).

## Highlights

- Six root pages: Messages, Characters, Presets, Lorebooks, Extensions, and Profile.
- A single-column conversation-style character list with unified character, storyline, and chat status management.
- Per-storyline restoration of model, preset, API endpoint, and SillyTavern Connection Profile.
- Native Persona inheritance: storyline settings override character bindings, which override the global Persona.
- Open username/password registration with isolated characters, chats, lorebooks, presets, Personas, and API keys for every user.
- Light and dark themes, responsive mobile layouts, and a consistent liquid-glass visual system.
- Compatibility-focused integration that preserves SillyTavern DOM events, data formats, and extension APIs.
- Integrated Horae support and global floating-tool compatibility for extensions such as External Phone.

## Install and run

1. Install Node.js 20 or newer.
2. Run `npm install` in the project directory.
3. On Windows, launch `Start.bat`; on other platforms, run `npm start`.
4. Open `http://127.0.0.1:8000/` by default.

The first registered account becomes the administrator. Later registrations create regular users. The public repository contains no local user data, conversations, character cards, API keys, or personal configuration.

## Compatibility and roadmap

The redesigned UI uses a separate shell around SillyTavern's existing controls and events. Chats, characters, presets, and extension data remain in their native formats. True server-side generation across multiple storylines, including continuing after the browser closes, still requires migration to a server task queue.

## License and credits

This project is based on [SillyTavern](https://github.com/SillyTavern/SillyTavern) and is distributed under the GNU AGPL-3.0 license. Thanks to the SillyTavern community and the developers of the included extensions.
