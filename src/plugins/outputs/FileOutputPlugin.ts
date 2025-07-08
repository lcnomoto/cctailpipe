import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { BaseOutputPlugin } from './BaseOutputPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface FileOutputOptions {
  outputPath: string;
  mode?: 'append' | 'overwrite';
  createDir?: boolean;
  format?: 'jsonl' | 'json';
}

class FileOutputPlugin extends BaseOutputPlugin {
  readonly name = 'FileOutput';
  
  private outputPath: string;
  private mode: 'append' | 'overwrite';
  private createDir: boolean;
  private format: 'jsonl' | 'json';
  private isFirstWrite = true;

  constructor(options: FileOutputOptions) {
    super();
    this.outputPath = resolve(options.outputPath);
    this.mode = options.mode ?? 'append';
    this.createDir = options.createDir ?? true;
    this.format = options.format ?? 'jsonl';
  }

  async output(record: JsonlRecord): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      
      const content = this.formatContent(record);
      
      if (this.mode === 'overwrite' && this.isFirstWrite) {
        await writeFile(this.outputPath, content);
        this.isFirstWrite = false;
      } else {
        await appendFile(this.outputPath, content);
      }
    } catch (error) {
      console.error(`ファイル出力エラー: ${this.outputPath}`, error);
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    if (!this.createDir) return;
    
    const dir = dirname(this.outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private formatContent(record: JsonlRecord): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify(record, null, 2) + '\n';
      case 'jsonl':
      default:
        return JSON.stringify(record) + '\n';
    }
  }
}

export default FileOutputPlugin;