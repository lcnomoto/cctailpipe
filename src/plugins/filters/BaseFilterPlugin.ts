import { FilterPlugin, JsonlRecord } from '../../types/index.js';

export abstract class BaseFilterPlugin implements FilterPlugin {
  abstract readonly name: string;
  
  abstract filter(record: JsonlRecord): boolean | Promise<boolean>;
  
  protected log(message: string): void {
    console.log(`[Filter:${this.name}] ${message}`);
  }
}