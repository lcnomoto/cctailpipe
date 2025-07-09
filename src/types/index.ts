export interface JsonlRecord {
  [key: string]: unknown;
}

export interface FilterPlugin {
  name: string;
  filter(record: JsonlRecord): boolean | Promise<boolean>;
}

export interface OutputPlugin {
  name: string;
  output(record: JsonlRecord): void | Promise<void>;
}

// 設定ファイル用の型定義
export interface FilterPluginConfig {
  name: string;
  module: string;
  options?: Record<string, unknown>;
}

export interface OutputPluginConfig {
  name: string;
  module: string;
  options?: Record<string, unknown>;
}

export interface ProcessingPipeline {
  name: string;
  filter?: string;
  outputs: string[];
}

// 設定ファイル用の型定義
export interface ServerConfigFile {
  watchDirectory: string;
  plugins: {
    filters: FilterPluginConfig[];
    outputs: OutputPluginConfig[];
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

// 実行時の設定型定義（プラグインインスタンス）
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
  stats?: unknown;
}