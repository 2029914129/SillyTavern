# New Tavern

[English](readme.md) | [简体中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [한국어](readme-ko_kr.md) | [Deutsch](readme-de_de.md) | [Русский](readme-ru_ru.md) | **Français** | [Español](readme-es_es.md)

New Tavern est un espace de discussion multi-utilisateur avec des personnages IA, basé sur SillyTavern `1.18.0`. Le projet conserve le moteur de chat, les cartes de personnages, les lorebooks, les préréglages, les Personas, les connexions API et le système d'extensions de SillyTavern, tout en proposant une nouvelle interface pour ordinateur et mobile.

> **Dernière mise à jour : 13 août 2026**  
> La nouvelle interface, les thèmes clair et sombre, le style Liquid Glass, l'intégration de Horae et la couche flottante globale pour External Phone sont disponibles. Consultez le [journal complet des modifications](../CHANGELOG_NEW_UI.md).

## Fonctionnalités principales

- Six pages principales : Messages, Personnages, Préréglages, Lorebooks, Extensions et Profil.
- Une liste de conversations sur une seule colonne pour gérer personnages, scénarios et état des discussions.
- Restauration du modèle, du préréglage, de l'adresse API et du Connection Profile pour chaque scénario.
- Héritage Persona natif : le scénario remplace la liaison du personnage, qui remplace la Persona globale.
- Inscription par nom d'utilisateur et mot de passe, avec isolation des personnages, discussions, lorebooks, préréglages, Personas et clés API pour chaque utilisateur.
- Thèmes clair et sombre, interface mobile adaptative et système visuel Liquid Glass cohérent.
- Conservation des événements DOM, formats de données et API d'extensions de SillyTavern pour assurer la compatibilité des plugins.
- Intégration de Horae et prise en charge d'outils flottants globaux comme External Phone.

## Installation et démarrage

1. Installez Node.js 20 ou une version plus récente.
2. Exécutez `npm install` dans le dossier du projet.
3. Sous Windows, lancez `Start.bat` ; sur les autres plateformes, utilisez `npm start`.
4. L'adresse par défaut est `http://127.0.0.1:8000/`.

Le premier compte inscrit devient administrateur ; les suivants sont des utilisateurs ordinaires. Le dépôt public ne contient aucune donnée utilisateur locale, conversation, carte de personnage, clé API ou configuration personnelle.

## Compatibilité et feuille de route

La nouvelle interface utilise une couche indépendante autour des contrôles et événements existants de SillyTavern. Les discussions, personnages, préréglages et données d'extensions conservent leurs formats natifs. La génération parallèle côté serveur sur plusieurs scénarios, y compris après la fermeture du navigateur, doit encore être migrée vers une file de tâches serveur.

## Licence et remerciements

Ce projet est basé sur [SillyTavern](https://github.com/SillyTavern/SillyTavern) et distribué sous licence GNU AGPL-3.0. Merci à la communauté SillyTavern et aux développeurs des extensions.
