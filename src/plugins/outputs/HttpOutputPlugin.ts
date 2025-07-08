import { BaseOutputPlugin } from './BaseOutputPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface HttpOutputOptions {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  batchSize?: number;
  batchTimeoutMs?: number;
}

class HttpOutputPlugin extends BaseOutputPlugin {
  readonly name = 'HttpOutput';
  
  private url: string;
  private method: 'POST' | 'PUT' | 'PATCH';
  private headers: Record<string, string>;
  private timeout: number;
  private retries: number;
  private batchSize: number;
  private batchTimeoutMs: number;
  private batch: JsonlRecord[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: HttpOutputOptions) {
    super();
    this.url = options.url;
    this.method = options.method ?? 'POST';
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 3;
    this.batchSize = options.batchSize ?? 1;
    this.batchTimeoutMs = options.batchTimeoutMs ?? 5000;
  }

  async output(record: JsonlRecord): Promise<void> {
    if (this.batchSize === 1) {
      await this.sendSingle(record);
    } else {
      await this.addToBatch(record);
    }
  }

  private async sendSingle(record: JsonlRecord): Promise<void> {
    await this.sendRequest([record]);
  }

  private async addToBatch(record: JsonlRecord): Promise<void> {
    this.batch.push(record);

    if (this.batch.length >= this.batchSize) {
      await this.flushBatch();
    } else if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.batchTimeoutMs);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batchToSend = [...this.batch];
    this.batch = [];

    await this.sendRequest(batchToSend);
  }

  private async sendRequest(records: JsonlRecord[]): Promise<void> {
    const body = records.length === 1 ? records[0] : records;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await fetch(this.url, {
          method: this.method,
          headers: this.headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return;
      } catch (error) {
        const isLastAttempt = attempt === this.retries - 1;
        
        if (isLastAttempt) {
          console.error(`HTTP出力エラー (${this.url}):`, error);
          throw error;
        } else {
          console.warn(`HTTP出力リトライ ${attempt + 1}/${this.retries} (${this.url}):`, error);
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default HttpOutputPlugin;