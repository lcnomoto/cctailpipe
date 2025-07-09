import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { FileWatcher } from './FileWatcher.js';
import { JsonlStreamProcessor } from './JsonlStreamProcessor.js';
import { ProcessingPipelineManager } from './ProcessingPipelineManager.js';
import { ServerConfig, FileWatchEvent, FilterPlugin, OutputPlugin } from '../types/index.js';

export class JsonlStreamServer extends EventEmitter {
  private config: ServerConfig;
  private fileWatcher: FileWatcher;
  private processor: JsonlStreamProcessor;
  private pipelineManager: ProcessingPipelineManager;
  private isRunning = false;

  constructor(config: ServerConfig) {
    super();
    this.config = config;
    this.fileWatcher = new FileWatcher(
      config.watchDirectory,
      config.options.debounceMs
    );
    this.pipelineManager = new ProcessingPipelineManager();
    this.processor = new JsonlStreamProcessor(
      this.pipelineManager, 
      config.options.enableBuffering !== false
    );
    
    this.setupEventHandlers();
    this.loadPlugins();
  }

  private setupEventHandlers(): void {
    // FileWatcher イベント
    this.fileWatcher.on('file-event', (event: FileWatchEvent) => {
      this.handleFileEvent(event);
    });

    // 初期ファイル位置の設定
    this.fileWatcher.on('initialize-position', (filePath: string) => {
      if (this.config.options.enableBuffering !== false) {
        this.processor.initializeFilePosition(filePath);
      }
    });

    this.fileWatcher.on('error', (error) => {
      console.error('FileWatcher エラー:', error);
      this.emit('error', error);
    });

    // JsonlStreamProcessor イベント
    this.processor.on('processing-start', (filePath: string) => {
      console.log(`処理開始: ${filePath}`);
    });

    this.processor.on('processing-complete', (filePath: string) => {
      console.log(`処理完了: ${filePath}`);
    });

    this.processor.on('record-filtered-global', (data) => {
      if (this.config.options.logLevel === 'debug') {
        console.log(`グローバルフィルター除外: ${data.filePath}:${data.lineNumber}`);
      }
    });

    this.processor.on('record-filtered-pipeline', (data) => {
      if (this.config.options.logLevel === 'debug') {
        console.log(`パイプラインフィルター除外: ${data.pipeline} (${data.filter}) - ${data.filePath}:${data.lineNumber}`);
      }
    });

    this.processor.on('record-output-pipeline', (data) => {
      if (this.config.options.logLevel === 'debug') {
        console.log(`パイプライン出力完了: ${data.pipeline} -> ${data.output} - ${data.filePath}:${data.lineNumber}`);
      }
    });

    this.processor.on('record-output-global', (data) => {
      if (this.config.options.logLevel === 'debug') {
        console.log(`グローバル出力完了: ${data.output} - ${data.filePath}:${data.lineNumber}`);
      }
    });

    this.processor.on('pipeline-results', (data) => {
      if (this.config.options.logLevel === 'debug') {
        console.log(`パイプライン処理結果: ${data.filePath}:${data.lineNumber}`, data.results);
      }
    });

    this.processor.on('parse-error', (data) => {
      console.error(`JSON解析エラー: ${data.filePath}:${data.lineNumber}`, data.error);
    });

    this.processor.on('pipeline-error', (data) => {
      console.error(`パイプライン処理エラー: ${data.filePath}:${data.lineNumber}`, data.error);
    });
  }

  private loadPlugins(): void {
    // フィルタープラグインを登録
    this.config.plugins.filters.forEach(filter => {
      this.pipelineManager.addFilter(filter);
      console.log(`フィルタープラグイン登録: ${filter.name}`);
    });

    // 出力プラグインを登録
    this.config.plugins.outputs.forEach(output => {
      this.pipelineManager.addOutput(output);
      console.log(`出力プラグイン登録: ${output.name}`);
    });

    // パイプライン設定
    this.pipelineManager.setPipelines(this.config.pipelines);
    console.log(`パイプライン設定: ${this.config.pipelines.length}個`);

    // グローバルフィルター設定
    if (this.config.globalFilters) {
      this.pipelineManager.setGlobalFilters(this.config.globalFilters);
      console.log(`グローバルフィルター設定: ${this.config.globalFilters.join(', ')}`);
    }

    // グローバル出力設定
    if (this.config.globalOutputs) {
      this.pipelineManager.setGlobalOutputs(this.config.globalOutputs);
      console.log(`グローバル出力設定: ${this.config.globalOutputs.join(', ')}`);
    }
  }

  private async handleFileEvent(event: FileWatchEvent): Promise<void> {
    if (event.type === 'unlink') {
      console.log(`ファイル削除を検知: ${event.path}`);
      this.processor.resetFilePosition(event.path);
      return;
    }

    if (!existsSync(event.path)) {
      console.warn(`ファイルが存在しません: ${event.path}`);
      return;
    }

    try {
      await this.processor.processFile(event.path);
    } catch (error) {
      console.error(`ファイル処理エラー: ${event.path}`, error);
      this.emit('processing-error', { filePath: event.path, error });
    }
  }

  start(): void {
    if (this.isRunning) {
      console.warn('サーバーは既に実行中です');
      return;
    }

    console.log('JSONLストリームサーバー開始...');
    console.log(`監視ディレクトリ: ${this.config.watchDirectory}`);
    
    if (!existsSync(this.config.watchDirectory)) {
      throw new Error(`監視ディレクトリが存在しません: ${this.config.watchDirectory}`);
    }

    this.isRunning = true;
    this.fileWatcher.start();
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn('サーバーは実行されていません');
      return;
    }

    console.log('JSONLストリームサーバー停止中...');
    this.isRunning = false;
    this.fileWatcher.stop();
    this.emit('stopped');
  }

  addFilter(filter: FilterPlugin): void {
    this.pipelineManager.addFilter(filter);
    console.log(`フィルタープラグイン追加: ${filter.name}`);
  }

  addOutput(output: OutputPlugin): void {
    this.pipelineManager.addOutput(output);
    console.log(`出力プラグイン追加: ${output.name}`);
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }
}