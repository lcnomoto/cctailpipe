import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import { JsonlRecord } from '../types/index.js';
import { ProcessingPipelineManager } from './ProcessingPipelineManager.js';

export class JsonlStreamProcessor extends EventEmitter {
  private pipelineManager: ProcessingPipelineManager;
  private isProcessing = false;

  constructor(pipelineManager: ProcessingPipelineManager) {
    super();
    this.pipelineManager = pipelineManager;
    this.setupPipelineEventHandlers();
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

      this.emit('processing-complete', filePath);
    } catch (error) {
      console.error(`ファイル処理エラー (${filePath}):`, error);
      this.emit('processing-error', { filePath, error });
    } finally {
      this.isProcessing = false;
    }
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