import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ServerConfig, FilterPlugin, OutputPlugin } from '../types/index.js';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = './config-compact-summary.json') {
    this.configPath = resolve(configPath);
  }

  async loadConfig(): Promise<ServerConfig> {
    if (!existsSync(this.configPath)) {
      console.warn(`設定ファイルが見つかりません: ${this.configPath}`);
      return this.getDefaultConfigFromCompactSummary();
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

  private async validateAndTransformConfig(config: unknown): Promise<ServerConfig> {
    const configObj = config as Record<string, unknown>;
    let watchDirectory = (configObj.watchDirectory as string) || process.env.HOME + '/.claude/projects';
    
    // ~を実際のホームディレクトリに置換
    if (watchDirectory.startsWith('~/')) {
      watchDirectory = watchDirectory.replace('~/', process.env.HOME + '/');
    }
    
    // プラグインの動的読み込み
    const filters: FilterPlugin[] = [];
    const outputs: OutputPlugin[] = [];

    const plugins = configObj.plugins as Record<string, unknown>;
    if (plugins?.filters) {
      const filterConfigs = plugins.filters as Array<Record<string, unknown>>;
      for (const filterConfig of filterConfigs) {
        try {
          const filter = await this.loadFilterPlugin(filterConfig.module as string, filterConfig.options as Record<string, unknown>);
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

    if (plugins?.outputs) {
      const outputConfigs = plugins.outputs as Array<Record<string, unknown>>;
      for (const outputConfig of outputConfigs) {
        try {
          const output = await this.loadOutputPlugin(outputConfig.module as string, outputConfig.options as Record<string, unknown>);
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

    const options = (configObj.options as Record<string, unknown>) || {};
    return {
      watchDirectory,
      plugins: {
        filters,
        outputs
      },
      pipelines: ((configObj.pipelines as Array<Record<string, unknown>>) || []) as any,
      globalFilters: (configObj.globalFilters as Array<string>) || [],
      globalOutputs: (configObj.globalOutputs as Array<string>) || [],
      options: {
        debounceMs: (options.debounceMs as number) || 1000,
        maxRetries: (options.maxRetries as number) || 3,
        logLevel: (options.logLevel as 'debug' | 'info' | 'warn' | 'error') || 'info'
      }
    };
  }

  private async loadFilterPlugin(modulePath: string, options: Record<string, unknown> = {}): Promise<FilterPlugin> {
    const plugin = await this.loadPlugin(modulePath, options);
    return plugin as FilterPlugin;
  }

  private async loadOutputPlugin(modulePath: string, options: Record<string, unknown> = {}): Promise<OutputPlugin> {
    const plugin = await this.loadPlugin(modulePath, options);
    return plugin as OutputPlugin;
  }

  private async loadPlugin(modulePath: string, options: Record<string, unknown> = {}): Promise<unknown> {
    let PluginModule;
    
    // npmパッケージからのインポート（cctailpipe/...）またはNode.jsモジュールの場合
    if (!modulePath.startsWith('./') && !modulePath.startsWith('/')) {
      try {
        PluginModule = await import(modulePath);
      } catch (error) {
        console.error(`npmパッケージとしてのインポートに失敗: ${modulePath}`, error);
        throw error;
      }
    } else {
      // ローカルファイルパスの場合
      const fullPath = resolve(modulePath);
      PluginModule = await import(fullPath);
    }
    
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

  private async getDefaultConfigFromCompactSummary(): Promise<ServerConfig> {
    const compactSummaryConfig = {
      "watchDirectory": "/Users/lcnomoto/.claude/projects",
      "plugins": {
        "filters": [
          {
            "name": "IsCompactSummaryFilter",
            "module": "cctailpipe/dist/plugins/filters/FieldMatchFilterPlugin.js",
            "options": {
              "field": "isCompactSummary",
              "value": true,
              "operator": "equals"
            }
          },
          {
            "name": "Has_message.content[0].text_Filter",
            "module": "cctailpipe/dist/plugins/filters/FieldMatchFilterPlugin.js",
            "options": {
              "field": "message.content[0].text",
              "operator": "exists"
            }
          },
          {
            "name": "NotHave_message.content[0].text_Filter",
            "module": "cctailpipe/dist/plugins/filters/FieldMatchFilterPlugin.js",
            "options": {
              "field": "message.content[0].text",
              "operator": "notexists"
            }
          }
        ],
        "outputs": [
          {
            "name": "FilteredDataOutput",
            "module": "cctailpipe/dist/plugins/outputs/FileOutputPlugin.js",
            "options": {
              "outputPath": "./output/filtered-data.jsonl",
              "mode": "append"
            }
          },
          {
            "name": "MarkdownOutput_message.content",
            "module": "cctailpipe/dist/plugins/outputs/MarkdownOutputPlugin.js",
            "options": {
              "outputDir": "./output/markdown",
              "markdownField": "message.content",
              "filenameField": "timestamp",
              "mode": "multiple",
              "includeMetadata": false
            }
          },
          {
            "name": "MarkdownOutput_message.content[0].text",
            "module": "cctailpipe/dist/plugins/outputs/MarkdownOutputPlugin.js",
            "options": {
              "outputDir": "./output/markdown",
              "markdownField": "message.content[0].text",
              "filenameField": "timestamp",
              "mode": "multiple",
              "includeMetadata": false
            }
          }
        ]
      },
      "pipelines": [
        {
          "name": "compactSummaryPipeline",
          "filters": [
            "IsCompactSummaryFilter",
            "Has_message.content[0].text_Filter"
          ],
          "outputs": [
            "MarkdownOutput_message.content[0].text",
            "FilteredDataOutput"
          ]
        },
        {
          "name": "compactSummaryPipeline",
          "filters": [
            "IsCompactSummaryFilter",
            "NotHave_message.content[0].text_Filter"
          ],
          "outputs": [
            "MarkdownOutput_message.content",
            "FilteredDataOutput"
          ]
        }
      ],
      "globalFilters": [],
      "globalOutputs": [],
      "options": {
        "debounceMs": 1000,
        "maxRetries": 3,
        "logLevel": "info"
      }
    };

    return await this.validateAndTransformConfig(compactSummaryConfig);
  }

}