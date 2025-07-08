import { EventEmitter } from 'events';
import { JsonlRecord, FilterPlugin, OutputPlugin, ProcessingPipeline } from '../types/index.js';

export class ProcessingPipelineManager extends EventEmitter {
  private filters: Map<string, FilterPlugin> = new Map();
  private outputs: Map<string, OutputPlugin> = new Map();
  private pipelines: ProcessingPipeline[] = [];
  private globalFilters: string[] = [];
  private globalOutputs: string[] = [];

  constructor() {
    super();
  }

  addFilter(filter: FilterPlugin): void {
    this.filters.set(filter.name, filter);
  }

  addOutput(output: OutputPlugin): void {
    this.outputs.set(output.name, output);
  }

  setPipelines(pipelines: ProcessingPipeline[]): void {
    this.pipelines = pipelines;
  }

  setGlobalFilters(filterNames: string[]): void {
    this.globalFilters = filterNames;
  }

  setGlobalOutputs(outputNames: string[]): void {
    this.globalOutputs = outputNames;
  }

  async processRecord(record: JsonlRecord, filePath: string, lineNumber: number): Promise<void> {
    try {
      // 全体フィルターをまず適用
      const passedGlobalFilters = await this.applyGlobalFilters(record);
      if (!passedGlobalFilters) {
        this.emit('record-filtered-global', { record, filePath, lineNumber });
        return;
      }

      // パイプライン処理
      const pipelineResults = await this.processPipelines(record, filePath, lineNumber);
      
      // 全体出力処理
      if (this.globalOutputs.length > 0) {
        await this.applyGlobalOutputs(record, filePath, lineNumber);
      }

      // パイプラインの結果をログ出力
      this.emit('pipeline-results', {
        record,
        filePath,
        lineNumber,
        results: pipelineResults
      });

    } catch (error) {
      console.error(`パイプライン処理エラー:`, error);
      this.emit('pipeline-error', { record, error, filePath, lineNumber });
    }
  }

  private async applyGlobalFilters(record: JsonlRecord): Promise<boolean> {
    for (const filterName of this.globalFilters) {
      const filter = this.filters.get(filterName);
      if (!filter) {
        console.warn(`グローバルフィルターが見つかりません: ${filterName}`);
        continue;
      }

      try {
        const shouldProcess = await filter.filter(record);
        if (!shouldProcess) {
          return false;
        }
      } catch (error) {
        console.error(`グローバルフィルターエラー (${filterName}):`, error);
        return false;
      }
    }
    return true;
  }

  private async processPipelines(record: JsonlRecord, filePath: string, lineNumber: number): Promise<PipelineResult[]> {
    const results: PipelineResult[] = [];

    for (const pipeline of this.pipelines) {
      try {
        const result = await this.processPipeline(pipeline, record, filePath, lineNumber);
        results.push(result);
      } catch (error) {
        console.error(`パイプライン処理エラー (${pipeline.name}):`, error);
        results.push({
          pipelineName: pipeline.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          outputResults: []
        });
      }
    }

    return results;
  }

  private async processPipeline(
    pipeline: ProcessingPipeline,
    record: JsonlRecord,
    filePath: string,
    lineNumber: number
  ): Promise<PipelineResult> {
    // パイプライン固有のフィルター適用
    if (pipeline.filter) {
      const filter = this.filters.get(pipeline.filter);
      if (!filter) {
        throw new Error(`フィルターが見つかりません: ${pipeline.filter}`);
      }

      const shouldProcess = await filter.filter(record);
      if (!shouldProcess) {
        this.emit('record-filtered-pipeline', {
          record,
          pipeline: pipeline.name,
          filter: pipeline.filter,
          filePath,
          lineNumber
        });
        return {
          pipelineName: pipeline.name,
          success: true,
          filtered: true,
          outputResults: []
        };
      }
    }

    // パイプライン固有の出力処理
    const outputResults: OutputResult[] = [];
    
    for (const outputName of pipeline.outputs) {
      const output = this.outputs.get(outputName);
      if (!output) {
        console.warn(`出力プラグインが見つかりません: ${outputName}`);
        outputResults.push({
          outputName,
          success: false,
          error: 'Output plugin not found'
        });
        continue;
      }

      try {
        await output.output(record);
        outputResults.push({
          outputName,
          success: true
        });
        this.emit('record-output-pipeline', {
          record,
          pipeline: pipeline.name,
          output: outputName,
          filePath,
          lineNumber
        });
      } catch (error) {
        console.error(`パイプライン出力エラー (${pipeline.name} -> ${outputName}):`, error);
        outputResults.push({
          outputName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      pipelineName: pipeline.name,
      success: true,
      filtered: false,
      outputResults
    };
  }

  private async applyGlobalOutputs(record: JsonlRecord, filePath: string, lineNumber: number): Promise<void> {
    for (const outputName of this.globalOutputs) {
      const output = this.outputs.get(outputName);
      if (!output) {
        console.warn(`グローバル出力プラグインが見つかりません: ${outputName}`);
        continue;
      }

      try {
        await output.output(record);
        this.emit('record-output-global', {
          record,
          output: outputName,
          filePath,
          lineNumber
        });
      } catch (error) {
        console.error(`グローバル出力エラー (${outputName}):`, error);
      }
    }
  }
}

interface PipelineResult {
  pipelineName: string;
  success: boolean;
  filtered?: boolean;
  error?: string;
  outputResults: OutputResult[];
}

interface OutputResult {
  outputName: string;
  success: boolean;
  error?: string;
}