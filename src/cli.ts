#!/usr/bin/env node

import { JsonlStreamServer } from './core/JsonlStreamServer.js';
import { ConfigLoader } from './config/ConfigLoader.js';

interface CliOptions {
  config?: string;
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      default:
        // 設定ファイルパスが直接指定された場合
        if (!arg.startsWith('-') && !options.config) {
          options.config = arg;
        }
        break;
    }
  }
  
  return options;
}

function printHelp(): void {
  console.log(`
cctailpipe - Claude Code向けJSONLストリーム処理ツール

使用方法:
  cctailpipe [オプション] [設定ファイル]

オプション:
  -c, --config <file>      設定ファイルを指定
  -h, --help              このヘルプを表示
  -v, --version           バージョンを表示

例:
  # デフォルト設定で起動
  cctailpipe
  
  # 設定ファイルを指定して起動
  cctailpipe config.json
  cctailpipe --config my-config.json
`);
}

function printVersion(): void {
  // package.jsonから動的に読み込む
  console.log('1.0.0');
}


async function startServer(configPath?: string): Promise<void> {
  try {
    const configLoader = new ConfigLoader(configPath);
    const config = await configLoader.loadConfig();
    const server = new JsonlStreamServer(config);
    
    console.log('JSONLストリームサーバーを起動中...');
    
    // シグナルハンドリング
    process.on('SIGINT', () => {
      console.log('\nサーバーを停止中...');
      server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nサーバーを停止中...');
      server.stop();
      process.exit(0);
    });
    
    server.start();
    console.log('サーバーが起動しました');
    
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    return;
  }
  
  if (options.version) {
    printVersion();
    return;
  }
  
  
  await startServer(options.config);
}

// エラーハンドリング
process.on('unhandledRejection', (reason) => {
  console.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
  process.exit(1);
});

// CLI実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('CLI実行エラー:', error);
    process.exit(1);
  });
}