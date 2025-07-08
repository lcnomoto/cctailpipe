import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ServerConfig, FilterPlugin, OutputPlugin } from '../types/index.js';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = './config.json') {
    this.configPath = resolve(configPath);
  }

  async loadConfig(): Promise<ServerConfig> {
    if (!existsSync(this.configPath)) {
      console.warn(`設定ファイルが見つかりません: ${this.configPath}`);
      return this.getDefaultConfig();
    }

    try {
      const configContent = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      return await this.validateAndTransformConfig(config);
    } catch (error) {
      console.error(`設定ファイルの読み込みエラー: ${this.configPath}`, error);
      throw error;
    }
  }

  private async validateAndTransformConfig(config: any): Promise<ServerConfig> {
    const watchDirectory = config.watchDirectory || process.env.HOME + '/.claude/projects';
    
    // プラグインの動的読み込み
    const filters: FilterPlugin[] = [];
    const outputs: OutputPlugin[] = [];

    if (config.plugins?.filters) {
      for (const filterConfig of config.plugins.filters) {
        try {
          const filter = await this.loadPlugin(filterConfig.module, filterConfig.options);
          // 設定ファイルで指定された名前を使用
          if (filterConfig.name) {
            Object.defineProperty(filter, 'name', { value: filterConfig.name, writable: false });
          }
          filters.push(filter);
        } catch (error) {
          console.error(`フィルタープラグイン読み込みエラー: ${filterConfig.module}`, error);
        }
      }
    }

    if (config.plugins?.outputs) {
      for (const outputConfig of config.plugins.outputs) {
        try {
          const output = await this.loadPlugin(outputConfig.module, outputConfig.options);
          // 設定ファイルで指定された名前を使用
          if (outputConfig.name) {
            Object.defineProperty(output, 'name', { value: outputConfig.name, writable: false });
          }
          outputs.push(output);
        } catch (error) {
          console.error(`出力プラグイン読み込みエラー: ${outputConfig.module}`, error);
        }
      }
    }

    return {
      watchDirectory,
      plugins: {
        filters,
        outputs
      },
      pipelines: config.pipelines || [],
      globalFilters: config.globalFilters || [],
      globalOutputs: config.globalOutputs || [],
      options: {
        debounceMs: config.options?.debounceMs || 1000,
        maxRetries: config.options?.maxRetries || 3,
        logLevel: config.options?.logLevel || 'info'
      }
    };
  }

  private async loadPlugin(modulePath: string, options: any = {}): Promise<any> {
    const fullPath = resolve(modulePath);
    const PluginModule = await import(fullPath);
    
    // デフォルトエクスポートまたは名前付きエクスポートを処理
    let PluginClass;
    if (PluginModule.default) {
      PluginClass = PluginModule.default;
    } else {
      // 名前付きエクスポートから最初のコンストラクタを探す
      const exportedNames = Object.keys(PluginModule);
      const constructorName = exportedNames.find(name => 
        typeof PluginModule[name] === 'function' && 
        PluginModule[name].prototype && 
        PluginModule[name].prototype.constructor === PluginModule[name]
      );
      
      if (constructorName) {
        PluginClass = PluginModule[constructorName];
      } else {
        throw new Error(`プラグインクラスが見つかりません: ${modulePath}`);
      }
    }
    
    if (typeof PluginClass !== 'function') {
      throw new Error(`プラグインがコンストラクタではありません: ${modulePath}`);
    }
    
    return new PluginClass(options);
  }

  private getDefaultConfig(): ServerConfig {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    
    return {
      watchDirectory: resolve(homeDir, '.claude', 'projects'),
      plugins: {
        filters: [],
        outputs: []
      },
      pipelines: [],
      globalFilters: [],
      globalOutputs: [],
      options: {
        debounceMs: 1000,
        maxRetries: 3,
        logLevel: 'info'
      }
    };
  }

  generateSampleConfig(): string {
    const sampleConfig = {
      watchDirectory: process.env.HOME + '/.claude/projects',
      plugins: {
        filters: [
          {
            name: 'ErrorFilter',
            module: './dist/plugins/filters/KeywordFilterPlugin.js',
            options: {
              keywords: ['error', 'ERROR'],
              mode: 'include',
              caseSensitive: false
            }
          },
          {
            name: 'WarningFilter',
            module: './dist/plugins/filters/KeywordFilterPlugin.js',
            options: {
              keywords: ['warning', 'WARNING', 'warn'],
              mode: 'include',
              caseSensitive: false
            }
          },
          {
            name: 'UserActionFilter',
            module: './dist/plugins/filters/FieldMatchFilterPlugin.js',
            options: {
              field: 'action',
              value: 'login',
              operator: 'equals'
            }
          },
          {
            name: 'HighPriorityFilter',
            module: './dist/plugins/filters/FieldMatchFilterPlugin.js',
            options: {
              field: 'priority',
              value: 5,
              operator: 'gte'
            }
          }
        ],
        outputs: [
          {
            name: 'ConsoleOutput',
            module: './dist/plugins/outputs/ConsoleOutputPlugin.js',
            options: {
              format: 'pretty',
              timestamp: true
            }
          },
          {
            name: 'ErrorLogOutput',
            module: './dist/plugins/outputs/FileOutputPlugin.js',
            options: {
              outputPath: './output/errors.jsonl',
              mode: 'append'
            }
          },
          {
            name: 'WarningLogOutput',
            module: './dist/plugins/outputs/FileOutputPlugin.js',
            options: {
              outputPath: './output/warnings.jsonl',
              mode: 'append'
            }
          },
          {
            name: 'AllDataOutput',
            module: './dist/plugins/outputs/FileOutputPlugin.js',
            options: {
              outputPath: './output/all-data.jsonl',
              mode: 'append'
            }
          }
        ]
      },
      pipelines: [
        {
          name: 'ErrorPipeline',
          filter: 'ErrorFilter',
          outputs: ['ErrorLogOutput', 'ConsoleOutput']
        },
        {
          name: 'WarningPipeline',
          filter: 'WarningFilter',
          outputs: ['WarningLogOutput']
        },
        {
          name: 'UserActionPipeline',
          filter: 'UserActionFilter',
          outputs: ['ConsoleOutput']
        },
        {
          name: 'HighPriorityPipeline',
          filter: 'HighPriorityFilter',
          outputs: ['ConsoleOutput', 'ErrorLogOutput']
        }
      ],
      globalFilters: [],
      globalOutputs: ['AllDataOutput'],
      options: {
        debounceMs: 1000,
        maxRetries: 3,
        logLevel: 'info'
      }
    };

    return JSON.stringify(sampleConfig, null, 2);
  }
}