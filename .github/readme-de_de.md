# New Tavern

[English](readme.md) | [简体中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | **Deutsch** | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | [Español](readme-es_es.md)

New Tavern ist ein Mehrbenutzer-Arbeitsbereich für KI-Charakterchats auf Basis von SillyTavern `1.18.0`. Die Chat-Engine, Charakterkarten, Lorebooks, Presets, Personas, API-Verbindungen und das Erweiterungssystem von SillyTavern bleiben erhalten, während die Oberfläche für Desktop und Mobilgeräte neu gestaltet wurde.

> **Letzte Aktualisierung: 13. August 2026**  
> Die neue UI, helle und dunkle Designs, Liquid-Glass-Styling, Horae-Integration und globale Overlay-Unterstützung für External Phone sind verfügbar. Lies das [vollständige Änderungsprotokoll](../CHANGELOG_NEW_UI.md).

## Wichtigste Funktionen

- Sechs Hauptseiten: Nachrichten, Charaktere, Presets, Lorebooks, Erweiterungen und Profil.
- Einspaltige Gesprächsliste zur gemeinsamen Verwaltung von Charakteren, Handlungssträngen und Chatstatus.
- Wiederherstellung von Modell, Preset, API-Endpunkt und Connection Profile pro Handlungsstrang.
- Native Persona-Vererbung: Einstellungen des Handlungsstrangs überschreiben Charakterbindungen, diese überschreiben die globale Persona.
- Offene Registrierung mit Benutzername und Passwort; Charaktere, Chats, Lorebooks, Presets, Personas und API-Schlüssel werden pro Benutzer getrennt gespeichert.
- Helles und dunkles Design, responsive Mobilansicht und ein einheitliches Liquid-Glass-System.
- Erhalt der SillyTavern-DOM-Ereignisse, Datenformate und Erweiterungs-APIs für hohe Plugin-Kompatibilität.
- Integration von Horae und Unterstützung globaler schwebender Werkzeuge wie External Phone.

## Installation und Start

1. Installiere Node.js 20 oder neuer.
2. Führe im Projektordner `npm install` aus.
3. Starte unter Windows `Start.bat`; auf anderen Plattformen `npm start`.
4. Die Standardadresse ist `http://127.0.0.1:8000/`.

Das zuerst registrierte Konto wird Administrator, spätere Konten sind normale Benutzer. Das öffentliche Repository enthält keine lokalen Benutzerdaten, Unterhaltungen, Charakterkarten, API-Schlüssel oder persönlichen Einstellungen.

## Kompatibilität und Ausblick

Die neue UI verwendet eine separate Shell um die bestehenden Steuerelemente und Ereignisse von SillyTavern. Chats, Charaktere, Presets und Erweiterungsdaten behalten ihre ursprünglichen Formate. Echte serverseitige Parallelgenerierung über mehrere Handlungsstränge, auch nach dem Schließen des Browsers, muss noch in eine Server-Aufgabenwarteschlange migriert werden.

## Lizenz und Danksagung

Dieses Projekt basiert auf [SillyTavern](https://github.com/SillyTavern/SillyTavern) und wird unter der GNU AGPL-3.0 veröffentlicht. Vielen Dank an die SillyTavern-Community und die Entwickler der Erweiterungen.
