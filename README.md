# cctailpipe

`~/.claude/projects/` 配下のJSONLファイルをリアルタイムで監視し、ストリーム処理を行うClaude Code向けJSONLストリーム処理ツールです。

## 特徴

- **リアルタイム監視**: JSONLファイルの変更を自動検知
- **プラグインシステム**: フィルタリングと出力処理を拡張可能
- **TypeScript実装**: 型安全な開発環境
- **設定ファイル対応**: JSON形式で柔軟な設定管理

## インストール

### npm経由でのインストール（推奨）

```bash
# グローバルインストール
npm install -g cctailpipe

# プロジェクトローカルインストール
npm install cctailpipe
```

### 開発用のローカルインストール

```bash
git clone https://github.com/lcnomoto/cctailpipe.git
cd cctailpipe
npm install
```

## 使用方法

### npmパッケージとして使用する場合

```bash
# 基本的な起動
cctailpipe

# 設定ファイルを指定して起動
cctailpipe --config ./my-config.json
cctailpipe ./my-config.json

# ヘルプ表示
cctailpipe --help
```

### 開発環境での使用

```bash
# 基本的な起動
npm run dev

# 設定ファイルを指定して起動
npm run dev -- ./my-config.json

```

## 設定ファイル

設定ファイル例 (`config.json`):

```json
{
  "watchDirectory": "/Users/username/.claude/projects",
  "plugins": {
    "filters": [
      {
        "name": "ErrorFilter",
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
        "name": "ConsoleOutput",
        "module": "./dist/plugins/outputs/ConsoleOutputPlugin.js",
        "options": {
          "format": "pretty",
          "timestamp": true
        }
      },
      {
        "name": "FileOutput",
        "module": "./dist/plugins/outputs/FileOutputPlugin.js",
        "options": {
          "outputPath": "./output/filtered.jsonl",
          "mode": "append"
        }
      }
    ]
  },
  "pipelines": [
    {
      "name": "ErrorPipeline",
      "filter": "ErrorFilter",
      "outputs": ["FileOutput"]
    }
  ],
  "globalFilters": [],
  "globalOutputs": [
    "ConsoleOutput"
  ],
  "options": {
    "debounceMs": 1000,
    "maxRetries": 3,
    "logLevel": "info"
  }
}
```

## FieldMatchFilterPlugin の使用例

特定のフィールドの値で条件フィルタリングを行います：

```json
{
  "name": "StatusFilter",
  "module": "./dist/plugins/filters/FieldMatchFilterPlugin.js",
  "options": {
    "field": "status",          // チェックするフィールド
    "value": "error",           // マッチさせる値
    "operator": "equals",       // 比較演算子
    "caseSensitive": false,     // 大文字小文字を区別しない
    "mode": "include"           // 一致したものを通す
  }
}
```

### 利用可能な演算子

- `equals`: 完全一致
- `contains`: 部分一致
- `startsWith`: 前方一致
- `endsWith`: 後方一致
- `gt`: より大きい（数値）
- `gte`: 以上（数値）
- `lt`: より小さい（数値）
- `lte`: 以下（数値）
- `regex`: 正規表現マッチ

### ネストしたフィールドの指定

```json
{
  "field": "user.profile.age",
  "value": 18,
  "operator": "gte"
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
- **FieldMatchFilterPlugin**: フィールド値による条件フィルタリング

### 出力プラグイン

- **ConsoleOutputPlugin**: コンソール出力
- **FileOutputPlugin**: ファイル出力
- **HttpOutputPlugin**: HTTP API出力
- **MarkdownOutputPlugin**: Markdown形式でのファイル出力

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