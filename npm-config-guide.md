# npmパッケージでの設定ファイルの書き方

npmでインストールした`cctailpipe`を使用する場合、プラグインのパス指定が変わります。

## プラグインパスの違い

### ローカル開発時
```json
"module": "./dist/plugins/filters/KeywordFilterPlugin.js"
```

### npmパッケージ使用時
```json
"module": "cctailpipe/dist/plugins/filters/KeywordFilterPlugin.js"
```

## 利用可能なプラグイン

### フィルタープラグイン

1. **KeywordFilterPlugin** - キーワードベースのフィルタリング
   ```json
   {
     "module": "cctailpipe/dist/plugins/filters/KeywordFilterPlugin.js",
     "options": {
       "keywords": ["error", "warning", "critical"],
       "caseSensitive": false
     }
   }
   ```

2. **FieldMatchFilterPlugin** - 特定フィールドの値でフィルタリング
   ```json
   {
     "module": "cctailpipe/dist/plugins/filters/FieldMatchFilterPlugin.js",
     "options": {
       "field": "isCompactSummary",
       "value": true,
       "operator": "equals"
     }
   }
   ```

### 出力プラグイン

1. **ConsoleOutputPlugin** - コンソール出力
   ```json
   {
     "module": "cctailpipe/dist/plugins/outputs/ConsoleOutputPlugin.js",
     "options": {
       "format": "json",
       "useColors": true
     }
   }
   ```

2. **FileOutputPlugin** - ファイル出力
   ```json
   {
     "module": "cctailpipe/dist/plugins/outputs/FileOutputPlugin.js",
     "options": {
       "outputPath": "./output.jsonl",
       "append": true
     }
   }
   ```

3. **HttpOutputPlugin** - HTTP API出力
   ```json
   {
     "module": "cctailpipe/dist/plugins/outputs/HttpOutputPlugin.js",
     "options": {
       "url": "http://localhost:3000/api/jsonl",
       "method": "POST",
       "headers": {
         "Content-Type": "application/json"
       },
       "retryAttempts": 3
     }
   }
   ```

4. **MarkdownOutputPlugin** - Markdown形式出力
   ```json
   {
     "module": "cctailpipe/dist/plugins/outputs/MarkdownOutputPlugin.js",
     "options": {
       "outputPath": "./summary.md",
       "template": "## {{timestamp}}\n\n{{content}}\n\n---\n",
       "includeMetadata": true
     }
   }
   ```

## 使用例

### 基本的な使用方法
```bash
# 設定ファイルを作成
cat > myconfig.json << EOF
{
  "watchDirectory": "~/.claude/projects",
  "plugins": {
    "filters": [
      {
        "module": "cctailpipe/dist/plugins/filters/KeywordFilterPlugin.js",
        "options": {
          "keywords": ["error", "warning"]
        }
      }
    ],
    "outputs": [
      {
        "module": "cctailpipe/dist/plugins/outputs/ConsoleOutputPlugin.js",
        "options": {
          "format": "pretty"
        }
      }
    ]
  }
}
EOF

# 実行
npx cctailpipe myconfig.json
```

### パイプライン処理の例

複数のパイプラインを使用して、異なる条件で異なる出力を行う：

```json
{
  "watchDirectory": "~/.claude/projects",
  "pipelines": [
    {
      "name": "error-pipeline",
      "filters": [
        {
          "module": "cctailpipe/dist/plugins/filters/KeywordFilterPlugin.js",
          "options": {
            "keywords": ["error", "critical"]
          }
        }
      ],
      "outputs": [
        {
          "module": "cctailpipe/dist/plugins/outputs/FileOutputPlugin.js",
          "options": {
            "outputPath": "./errors.log"
          }
        }
      ]
    },
    {
      "name": "summary-pipeline",
      "filters": [
        {
          "module": "cctailpipe/dist/plugins/filters/FieldMatchFilterPlugin.js",
          "options": {
            "field": "isCompactSummary",
            "value": true
          }
        }
      ],
      "outputs": [
        {
          "module": "cctailpipe/dist/plugins/outputs/MarkdownOutputPlugin.js",
          "options": {
            "outputPath": "./summaries.md"
          }
        }
      ]
    }
  ]
}
```