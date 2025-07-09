import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { BaseOutputPlugin } from './BaseOutputPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface MarkdownOutputOptions {
  outputDir: string;                    // 出力ディレクトリ
  markdownField: string;                // Markdown文字列が入っているフィールド名
  filenameField?: string;               // ファイル名に使用するフィールド（オプション）
  filenamePrefix?: string;              // ファイル名のプレフィックス
  filenameSuffix?: string;              // ファイル名のサフィックス
  mode?: 'single' | 'multiple';         // single: 1ファイルに追記、multiple: レコード毎に別ファイル
  singleFileName?: string;              // modeがsingleの場合のファイル名
  includeMetadata?: boolean;            // メタデータをMarkdownに含めるか
  metadataFields?: string[];            // 含めるメタデータフィールド
  createDir?: boolean;                  // ディレクトリを自動作成するか
  templateHeader?: string;              // 各エントリのヘッダーテンプレート
  templateFooter?: string;              // 各エントリのフッターテンプレート
}

class MarkdownOutputPlugin extends BaseOutputPlugin {
  readonly name = 'MarkdownOutput';
  
  private outputDir: string;
  private markdownField: string;
  private filenameField?: string;
  private filenamePrefix: string;
  private filenameSuffix: string;
  private mode: 'single' | 'multiple';
  private singleFileName: string;
  private includeMetadata: boolean;
  private metadataFields: string[];
  private createDir: boolean;
  private templateHeader?: string;
  private templateFooter?: string;
  private fileCounter = 0;

  constructor(options: MarkdownOutputOptions) {
    super();
    this.outputDir = resolve(options.outputDir);
    this.markdownField = options.markdownField;
    this.filenameField = options.filenameField;
    this.filenamePrefix = options.filenamePrefix ?? '';
    this.filenameSuffix = options.filenameSuffix ?? '';
    this.mode = options.mode ?? 'multiple';
    this.singleFileName = options.singleFileName ?? 'output.md';
    this.includeMetadata = options.includeMetadata ?? true;
    this.metadataFields = options.metadataFields ?? [];
    this.createDir = options.createDir ?? true;
    this.templateHeader = options.templateHeader;
    this.templateFooter = options.templateFooter;
  }

  async output(record: JsonlRecord): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      
      const markdownContent = this.getNestedValue(record, this.markdownField);
      if (!markdownContent || typeof markdownContent !== 'string') {
        console.warn(`[MarkdownOutput] Markdownフィールドが見つからないか文字列ではありません: ${this.markdownField}`);
        return;
      }

      const content = this.formatContent(record, markdownContent);
      
      if (this.mode === 'single') {
        await this.outputToSingleFile(content);
      } else {
        await this.outputToMultipleFiles(record, content);
      }
    } catch (error) {
      console.error(`[MarkdownOutput] 出力エラー:`, error);
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    if (!this.createDir) return;
    
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }
  }

  private formatContent(record: JsonlRecord, markdownContent: string): string {
    let content = '';

    // ヘッダーテンプレート
    if (this.templateHeader) {
      content += this.interpolateTemplate(this.templateHeader, record) + '\n\n';
    }

    // メタデータセクション
    if (this.includeMetadata) {
      const metadata = this.buildMetadata(record);
      if (metadata) {
        content += '---\n';
        content += metadata;
        content += '---\n\n';
      }
    }

    // Markdownコンテンツ
    content += markdownContent;

    // フッターテンプレート
    if (this.templateFooter) {
      content += '\n\n' + this.interpolateTemplate(this.templateFooter, record);
    }

    return content;
  }

  private buildMetadata(record: JsonlRecord): string {
    const metadata: string[] = [];
    
    // タイムスタンプを追加
    metadata.push(`date: ${new Date().toISOString()}`);
    
    // 指定されたフィールドまたは全フィールドを含める
    const fields = this.metadataFields.length > 0 
      ? this.metadataFields 
      : Object.keys(record).filter(key => key !== this.markdownField);

    fields.forEach(field => {
      const value = this.getNestedValue(record, field);
      if (value !== undefined && value !== null && value !== '') {
        metadata.push(`${field}: ${JSON.stringify(value)}`);
      }
    });

    return metadata.join('\n') + '\n';
  }

  private async outputToSingleFile(content: string): Promise<void> {
    const filePath = join(this.outputDir, this.singleFileName);
    const separator = '\n\n---\n\n';
    
    // ファイルが存在する場合は区切り文字を追加して追記
    if (existsSync(filePath)) {
      await appendFile(filePath, separator + content);
    } else {
      await writeFile(filePath, content);
    }
  }

  private async outputToMultipleFiles(record: JsonlRecord, content: string): Promise<void> {
    const filename = this.generateFilename(record);
    const filePath = join(this.outputDir, filename);
    
    await writeFile(filePath, content);
  }

  private generateFilename(record: JsonlRecord): string {
    let filename = '';
    
    // プレフィックス
    if (this.filenamePrefix) {
      filename += this.filenamePrefix;
    }

    // メインファイル名
    if (this.filenameField) {
      const fieldValue = this.getNestedValue(record, this.filenameField);
      if (fieldValue) {
        filename += this.sanitizeFilename(String(fieldValue));
      } else {
        filename += this.generateDefaultFilename();
      }
    } else {
      filename += this.generateDefaultFilename();
    }

    // サフィックス
    if (this.filenameSuffix) {
      filename += this.filenameSuffix;
    }

    // 拡張子
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    return filename;
  }

  private generateDefaultFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.fileCounter++;
    return `${timestamp}_${this.fileCounter}`;
  }

  private sanitizeFilename(filename: string): string {
    // ファイル名に使用できない文字を置換
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 200); // 長すぎる場合は切り詰め
  }

  private interpolateTemplate(template: string, record: JsonlRecord): string {
    return template.replace(/\{\{(\S+?)\}\}/g, (match, field) => {
      const value = this.getNestedValue(record, field);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // 配列のインデックスアクセス (例: [0], [1]) をサポート
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const indexMatch = key.match(/\[(\d+)\]/);
        
        if (indexMatch) {
          const index = parseInt(indexMatch[1], 10);
          
          // 配列キーがある場合は先にそのプロパティにアクセス
          if (arrayKey) {
            if (typeof current === 'object' && current !== null) {
              current = (current as Record<string, unknown>)[arrayKey];
            } else {
              return undefined;
            }
          }
          
          // 配列のインデックスにアクセス
          if (Array.isArray(current)) {
            current = current[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        // 通常のプロパティアクセス
        if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }
    }
    
    return current;
  }
}

export default MarkdownOutputPlugin;