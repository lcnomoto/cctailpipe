# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`~/.claude/projects/` 配下のjsonlファイルをstreamリアルタイム処理で読み込んでいくサーバーアプリケーションです。

## 基本方針

- **言語**: 全てのコミュニケーション、ドキュメントのアウトプットは日本語で行う

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番環境実行
npm start

# 型チェック
npm run type-check

# リント
npm run lint
```

## アーキテクチャ

### コア機能
- `FileWatcher`: chokidarを使用したJSONLファイル監視
- `JsonlStreamProcessor`: ストリーム処理とプラグイン実行
- `JsonlStreamServer`: メインサーバークラス

### プラグインシステム
- フィルタープラグイン: `BaseFilterPlugin`を継承
- 出力プラグイン: `BaseOutputPlugin`を継承
- 設定ファイルで動的ロード可能

### 組み込みプラグイン
- **KeywordFilterPlugin**: キーワードベースフィルタリング
- **ConsoleOutputPlugin**: コンソール出力
- **FileOutputPlugin**: ファイル出力
- **HttpOutputPlugin**: HTTP API出力

## 技術スタック

- **言語**: TypeScript (ES2022, ESNext)
- **ファイル監視**: chokidar
- **ストリーム処理**: Node.js readline
- **設定管理**: JSON形式
- **開発環境**: tsx (TypeScript実行)

## プラグイン開発ガイド

新しいプラグインを作成する際は、既存のプラグインを参考にし、適切な基底クラスを継承してください。
