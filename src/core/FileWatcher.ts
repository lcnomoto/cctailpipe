import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { resolve, extname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { FileWatchEvent } from '../types/index.js';

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private watchDirectory: string;
  private debounceMs: number;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(watchDirectory: string, debounceMs: number = 1000) {
    super();
    this.watchDirectory = resolve(watchDirectory);
    this.debounceMs = debounceMs;
  }

  start(): void {
    if (this.watcher) {
      console.warn('FileWatcher は既に開始されています');
      return;
    }

    console.log(`JSONLファイル監視開始: ${this.watchDirectory}`);
    
    console.log(`監視ディレクトリ: ${this.watchDirectory}`);
    
    if (!existsSync(this.watchDirectory)) {
      console.error(`監視ディレクトリが存在しません: ${this.watchDirectory}`);
      return;
    }
    
    // まず最小設定でテスト
    this.watcher = chokidar.watch(this.watchDirectory, {
      persistent: true,
      ignoreInitial: false
    });

    this.watcher
      .on('add', (path) => {
        this.handleFileEvent('add', path);
      })
      .on('change', (path) => {
        this.handleFileEvent('change', path);
      })
      .on('unlink', (path) => {
        this.handleFileEvent('unlink', path);
      })
      .on('ready', () => {
        console.log('FileWatcher準備完了 - 監視開始');
        const watched = this.watcher?.getWatched();
        const totalDirs = watched ? Object.keys(watched).length : 0;
        const totalFiles = watched ? Object.values(watched).reduce((sum, files) => sum + files.length, 0) : 0;
        console.log(`監視対象: ${totalDirs}ディレクトリ、${totalFiles}ファイル`);
      })
      .on('error', (error) => {
        console.error('FileWatcher エラー:', error);
        this.emit('error', error);
      });

    this.emit('started', this.watchDirectory);
  }

  stop(): void {
    if (this.watcher) {
      console.log('FileWatcher 停止中...');
      this.watcher.close();
      this.watcher = null;
      
      // デバウンスタイマーをクリア
      this.debounceTimers.forEach((timer) => clearTimeout(timer));
      this.debounceTimers.clear();
      
      this.emit('stopped');
    }
  }

  private handleFileEvent(type: 'add' | 'change' | 'unlink', path: string): void {
    // JSONLファイルのみ処理
    if (extname(path).toLowerCase() !== '.jsonl') {
      return;
    }

    console.log(`JSONLファイル検出: ${type} - ${path}`);

    // デバウンス処理
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);
      
      const event: FileWatchEvent = {
        type,
        path: resolve(path)
      };
      
      console.log(`ファイルイベント: ${type} - ${path}`);
      this.emit('file-event', event);
    }, this.debounceMs);

    this.debounceTimers.set(path, timer);
  }
}