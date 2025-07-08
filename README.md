# JSONLストリームサーバー

`~/.claude/projects/` 配下のJSONLファイルをリアルタイムで監視し、ストリーム処理を行うサーバーアプリケーションです。

## 特徴

- **リアルタイム監視**: JSONLファイルの変更を自動検知
- **プラグインシステム**: フィルタリングと出力処理を拡張可能
- **TypeScript実装**: 型安全な開発環境
- **設定ファイル対応**: JSON形式で柔軟な設定管理

## インストール

```bash
npm install
```

## 使用方法

### 1. 基本的な起動

```bash
npm run dev
```

### 2. 設定ファイルを指定して起動

```bash
npm run dev -- ./my-config.json
```

### 3. 設定ファイルのサンプル生成

```bash
npm run dev -- --generate-config
```

## 設定ファイル

設定ファイル例 (`config.json`):

```json
{
  "watchDirectory": "/Users/username/.claude/projects",
  "plugins": {
    "filters": [
      {
        "module": "./dist/plugins/filters/KeywordFilterPlugin.js",
        "options": {
          "keywords": ["error", "warning"],
          "mode": "include",
          "caseSensitive": false
        }
      }
    ],
    "outputs": [
      {
        "module": "./dist/plugins/outputs/ConsoleOutputPlugin.js",
        "options": {
          "format": "pretty",
          "timestamp": true
        }
      },
      {
        "module": "./dist/plugins/outputs/FileOutputPlugin.js",
        "options": {
          "outputPath": "./output/filtered.jsonl",
          "mode": "append"
        }
      }
    ]
  },
  "options": {
    "debounceMs": 1000,
    "logLevel": "info"
  }
}
```

## プラグイン開発

### フィルタープラグイン

```typescript
import { BaseFilterPlugin } from './BaseFilterPlugin.js';
import { JsonlRecord } from '../../types/index.js';

export class MyFilterPlugin extends BaseFilterPlugin {
  readonly name = 'MyFilter';
  
  filter(record: JsonlRecord): boolean {
    // フィルタリングロジックを実装
    return true; // trueで処理続行、falseで除外
  }
}
```

### 出力プラグイン

```typescript
import { BaseOutputPlugin } from './BaseOutputPlugin.js';
import { JsonlRecord } from '../../types/index.js';

export class MyOutputPlugin extends BaseOutputPlugin {
  readonly name = 'MyOutput';
  
  async output(record: JsonlRecord): Promise<void> {
    // 出力処理を実装
    console.log(record);
  }
}
```

## 利用可能な組み込みプラグイン

### フィルタープラグイン

- **KeywordFilterPlugin**: キーワードベースのフィルタリング

### 出力プラグイン

- **ConsoleOutputPlugin**: コンソール出力
- **FileOutputPlugin**: ファイル出力
- **HttpOutputPlugin**: HTTP API出力

## 開発コマンド

```bash
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

```
src/
├── core/              # コア機能
│   ├── FileWatcher.ts      # ファイル監視
│   ├── JsonlStreamProcessor.ts  # ストリーム処理
│   └── JsonlStreamServer.ts     # メインサーバー
├── plugins/           # プラグインシステム
│   ├── filters/           # フィルタープラグイン
│   └── outputs/           # 出力プラグイン
├── config/            # 設定管理
├── types/             # 型定義
└── index.ts           # エントリーポイント
```

## ライセンス

MIT