# New Tavern

[English](readme.md) | [简体中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | [Français](readme-fr_fr.md) | **Español**

New Tavern es un espacio de chat multiusuario con personajes de IA basado en SillyTavern `1.18.0`. Conserva el motor de chat, las tarjetas de personajes, los lorebooks, los preajustes, las Personas, las conexiones API y el sistema de extensiones de SillyTavern, e incorpora una interfaz rediseñada para escritorio y móvil.

> **Última actualización: 13 de agosto de 2026**  
> Ya están disponibles la nueva interfaz, los temas claro y oscuro, el estilo Liquid Glass, la integración de Horae y la capa flotante global para External Phone. Consulta el [registro completo de cambios](../CHANGELOG_NEW_UI.md).

## Funciones principales

- Seis páginas raíz: Mensajes, Personajes, Preajustes, Lorebooks, Extensiones y Perfil.
- Lista de conversaciones de una sola columna para gestionar personajes, líneas argumentales y estado de los chats.
- Restauración del modelo, preajuste, dirección API y Connection Profile para cada línea argumental.
- Herencia nativa de Persona: la configuración de la historia prevalece sobre la vinculación del personaje, y esta sobre la Persona global.
- Registro con nombre de usuario y contraseña, con personajes, chats, lorebooks, preajustes, Personas y claves API aislados para cada usuario.
- Temas claro y oscuro, diseño móvil adaptable y un sistema visual Liquid Glass coherente.
- Conserva los eventos DOM, formatos de datos y API de extensiones de SillyTavern para mantener la compatibilidad con plugins.
- Integración de Horae y compatibilidad con herramientas flotantes globales como External Phone.

## Instalación y ejecución

1. Instala Node.js 20 o una versión posterior.
2. Ejecuta `npm install` en la carpeta del proyecto.
3. En Windows, inicia `Start.bat`; en otras plataformas, ejecuta `npm start`.
4. La dirección predeterminada es `http://127.0.0.1:8000/`.

La primera cuenta registrada se convierte en administradora; las siguientes son usuarios normales. El repositorio público no contiene datos locales de usuarios, conversaciones, tarjetas de personajes, claves API ni configuraciones personales.

## Compatibilidad y próximos pasos

La nueva interfaz utiliza una capa independiente alrededor de los controles y eventos existentes de SillyTavern. Los chats, personajes, preajustes y datos de extensiones mantienen sus formatos originales. La generación paralela real en el servidor para varias historias, incluso después de cerrar el navegador, todavía debe migrarse a una cola de tareas del servidor.

## Licencia y créditos

Este proyecto está basado en [SillyTavern](https://github.com/SillyTavern/SillyTavern) y se distribuye bajo la licencia GNU AGPL-3.0. Gracias a la comunidad de SillyTavern y a los desarrolladores de extensiones.
