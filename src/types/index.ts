export interface JsonlRecord {
  [key: string]: any;
}

export interface FilterPlugin {
  name: string;
  filter(record: JsonlRecord): boolean | Promise<boolean>;
}

export interface OutputPlugin {
  name: string;
  output(record: JsonlRecord): void | Promise<void>;
}

export interface ProcessingPipeline {
  name: string;
  filter?: string;
  outputs: string[];
}

export interface ServerConfig {
  watchDirectory: string;
  plugins: {
    filters: FilterPlugin[];
    outputs: OutputPlugin[];
  };
  pipelines: ProcessingPipeline[];
  globalFilters?: string[];
  globalOutputs?: string[];
  options: {
    debounceMs?: number;
    maxRetries?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  stats?: any;
}