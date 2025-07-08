import { OutputPlugin, JsonlRecord } from '../../types/index.js';

export abstract class BaseOutputPlugin implements OutputPlugin {
  abstract readonly name: string;
  
  abstract output(record: JsonlRecord): void | Promise<void>;
  
  protected log(message: string): void {
    console.log(`[Output:${this.name}] ${message}`);
  }
}