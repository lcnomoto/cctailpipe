import { createReadStream, stat } from 'fs';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import { JsonlRecord } from '../types/index.js';
import { ProcessingPipelineManager } from './ProcessingPipelineManager.js';

export class JsonlStreamProcessor extends EventEmitter {
  private pipelineManager: ProcessingPipelineManager;
  private isProcessing = false;
  private filePositions: Map<string, number> = new Map();
  private enableBuffering: boolean;

  constructor(pipelineManager: ProcessingPipelineManager, enableBuffering: boolean = true) {
    super();
    this.pipelineManager = pipelineManager;
    this.enableBuffering = enableBuffering;
    this.setupPipelineEventHandlers();
  }

  // 起動時に既存ファイルの末尾位置を記録
  async initializeFilePosition(filePath: string): Promise<void> {
    try {
      const stats = await new Promise<{ size: number }>((resolve, reject) => {
        stat(filePath, (err, stats) => {
          if (err) reject(err);
          else resolve({ size: stats.size });
        });
      });
      
      this.filePositions.set(filePath, stats.size);
      console.log(`ファイル位置を初期化: ${filePath} (${stats.size} bytes)`);
    } catch (error) {
      console.error(`ファイル位置初期化エラー: ${filePath}`, error);
    }
  }

  private setupPipelineEventHandlers(): void {
    this.pipelineManager.on('record-filtered-global', (data) => {
      this.emit('record-filtered-global', data);
    });

    this.pipelineManager.on('record-filtered-pipeline', (data) => {
      this.emit('record-filtered-pipeline', data);
    });

    this.pipelineManager.on('record-output-pipeline', (data) => {
      this.emit('record-output-pipeline', data);
    });

    this.pipelineManager.on('record-output-global', (data) => {
      this.emit('record-output-global', data);
    });

    this.pipelineManager.on('pipeline-results', (data) => {
      this.emit('pipeline-results', data);
    });

    this.pipelineManager.on('pipeline-error', (data) => {
      this.emit('pipeline-error', data);
    });
  }

  async processFile(filePath: string): Promise<void> {
    if (this.isProcessing) {
      console.warn(`既に処理中のファイルがあります: ${filePath}`);
      return;
    }

    this.isProcessing = true;
    this.emit('processing-start', filePath);

    try {
      if (this.enableBuffering) {
        await this.processFileWithBuffering(filePath);
      } else {
        await this.processFileComplete(filePath);
      }

      this.emit('processing-complete', filePath);
    } catch (error) {
      console.error(`ファイル処理エラー (${filePath}):`, error);
      this.emit('processing-error', { filePath, error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processFileComplete(filePath: string): Promise<void> {
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      
      if (line.trim() === '') continue;

      try {
        const record: JsonlRecord = JSON.parse(line);
        await this.processRecord(record, filePath, lineNumber);
      } catch (error) {
        console.error(`行 ${lineNumber} のJSON解析エラー (${filePath}):`, error);
        this.emit('parse-error', { filePath, lineNumber, line, error });
      }
    }
  }

  private async processFileWithBuffering(filePath: string): Promise<void> {
    const fileStats = await new Promise<{ size: number }>((resolve, reject) => {
      stat(filePath, (err, stats) => {
        if (err) reject(err);
        else resolve({ size: stats.size });
      });
    });

    const lastPosition = this.filePositions.get(filePath) || 0;
    
    // ファイルが小さくなった場合（truncateされた場合）は最初から読み込み
    if (fileStats.size < lastPosition) {
      console.log(`ファイルがtruncateされました: ${filePath}`);
      this.filePositions.set(filePath, 0);
      await this.processFileComplete(filePath);
      return;
    }

    // 新しいデータがない場合はスキップ
    if (fileStats.size === lastPosition) {
      console.log(`新しいデータがありません: ${filePath}`);
      return;
    }

    console.log(`バッファリング読み込み: ${filePath} (${lastPosition} -> ${fileStats.size})`);

    const fileStream = createReadStream(filePath, {
      start: lastPosition,
      encoding: 'utf8'
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = this.getLineNumberFromPosition(filePath, lastPosition);
    
    for await (const line of rl) {
      lineNumber++;
      
      if (line.trim() === '') continue;

      try {
        const record: JsonlRecord = JSON.parse(line);
        await this.processRecord(record, filePath, lineNumber);
      } catch (error) {
        console.error(`行 ${lineNumber} のJSON解析エラー (${filePath}):`, error);
        this.emit('parse-error', { filePath, lineNumber, line, error });
      }
    }

    // ファイル位置を更新
    this.filePositions.set(filePath, fileStats.size);
  }

  private getLineNumberFromPosition(filePath: string, position: number): number {
    // 簡易実装: 位置に基づいて行番号を推定
    // より正確な実装が必要な場合は、行番号も別途管理
    return position === 0 ? 0 : Math.floor(position / 100); // 平均100文字/行と仮定
  }

  // ファイル削除時に位置をリセット
  resetFilePosition(filePath: string): void {
    this.filePositions.delete(filePath);
    console.log(`ファイル位置をリセット: ${filePath}`);
  }

  // 全ファイル位置をリセット
  resetAllFilePositions(): void {
    this.filePositions.clear();
    console.log('全ファイル位置をリセット');
  }

  // バッファリング設定を取得
  isBufferingEnabled(): boolean {
    return this.enableBuffering;
  }

  // バッファリング設定を変更
  setBuffering(enabled: boolean): void {
    this.enableBuffering = enabled;
    console.log(`バッファリング設定: ${enabled ? '有効' : '無効'}`);
  }

  // 現在のファイル位置を取得
  getFilePosition(filePath: string): number {
    return this.filePositions.get(filePath) || 0;
  }

  private async processRecord(record: JsonlRecord, filePath: string, lineNumber: number): Promise<void> {
    try {
      await this.pipelineManager.processRecord(record, filePath, lineNumber);
    } catch (error) {
      console.error(`レコード処理エラー:`, error);
      this.emit('record-error', { record, error, filePath, lineNumber });
    }
  }
}