> [!IMPORTANT]  
> ここに掲載されている情報は、古かったり不完全であったりする可能性があります。最新の情報は英語版をご利用ください。

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md) | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | 日本語 | [Русский](readme-ru_ru.md) | [한국어](readme-ko_kr.md)

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

# new sillytavern

new sillytavernは [SillyTavern](https://github.com/SillyTavern/SillyTavern) をベースにしたコミュニティ製 UI リデザインです。よりシンプルなナビゲーション、モバイルデバイスでの操作しやすさ、統一されたビジュアル体験を求めるユーザーを主な対象としています。

本プロジェクトは SillyTavern のコア機能であるチャット、キャラクターカード、プリセット、ワールドブック、拡張機能を維持しつつ、主要ページ、ナビゲーション構造、テーマシステム、よく使う操作フローを再設計しています。

> 本プロジェクトは非公式のコミュニティ改変版であり、SillyTavern 公式チームとの所属関係はなく、公式バージョンや公式サポート窓口を代表するものでもありません。

## 主な変更点

- メッセージ、キャラクターカード、プリセット、ワールドブック、プラグイン、ユーザー設定などの主要ページを再設計；
- キャラクターセッションリストを単一列化し、キャラクター選択とチャット切り替えの体験を最適化；
- ダークモードとライトモードの両方に適したリキッドグラス（液体ガラス）のビジュアルエフェクトを追加；
- ボトムナビゲーションバーを作り直し、押下、バウンス、流体スライドのフィードバックを追加；
- 一般ユーザーが使用頻度の低い高度な入口を簡素化しつつ、基盤となる互換性は維持；
- プリセットとインターフェース設定を整理し、高度なオプションをカテゴリ別に折りたたみ；
- チャット入力欄メニュー、ツールパネル、通知、ローディングページを最適化；
- Horae 時光記憶プラグインの入口とパネルスタイルに適合；
- スマホの狭い画面、セーフエリア、ソフトキーボード、縦横画面の体験を改善；
- 柔らかなダークモードとライトモードを提供。

## 現在の状況

現在のバージョンは SillyTavern `1.18.0` をベースに開発されています。プロジェクトは継続的なテスト段階にあり、一部のサードパーティ拡張機能は、それ自体の更新やインターフェース構造の変更により互換性の問題が生じる可能性があります。

リリース版を使用する前に、キャラクターカード、チャット履歴、プリセット、ワールドブック、Persona、プラグインデータを必ずバックアップしてください。

## インストールと起動

### Windows

1. プロジェクトが要求する Node.js のバージョンと Git をインストールします。
2. 本リポジトリをクローンします。
3. プロジェクトが提供する起動スクリプトを実行します。
4. サービスの起動が完了したら、ブラウザでローカルページを開きます。

具体的な環境要件とコマンドについては、[インストールドキュメント](docs/installation.md) を参照してください。

## 公式バージョンとの関係

本プロジェクトは SillyTavern を改変したものであり、元のライセンスと著作権表示を保持しています。SillyTavern の公式ドキュメント、問題報告、更新情報については、公式リポジトリをご覧ください。

本リポジトリの改変に関する問題は本プロジェクトの Issues に投稿し、改変によって生じた問題を SillyTavern 公式のメンテナーに直接報告しないでください。

## データとプライバシー

本プロジェクトはリポジトリ内にユーザーの API Key、チャット履歴、キャラクターデータ、個人設定を一切提供しません。利用者は自身のサービスキーを適切に保管し、アップグレードや移行の前にデータをバックアップしてください。

## サードパーティ拡張機能

Horae、酒場助手、LittleWhiteBox などの拡張機能はそれぞれの作者によって保守されており、それぞれのライセンスが適用されます。本プロジェクトにおける関連拡張機能の説明は互換性の適合状況を示すものに過ぎず、それらの拡張機能を所有または再ライセンスするものではありません。

## ライセンス

本プロジェクトは SillyTavern の派生版であり、リポジトリ内の `LICENSE` ファイルに従って公開されています。サードパーティの依存関係、拡張機能、フォント、アイコン、その他のリソースにはそれぞれのライセンスが適用される場合がありますので、関連する著作権表示も併せてご確認ください。

## 謝辞

SillyTavern 公式チーム、コミュニティ貢献者、関連拡張機能の作者の皆様に、オープンソースプロジェクトとエコシステムのサポートに感謝いたします。
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
