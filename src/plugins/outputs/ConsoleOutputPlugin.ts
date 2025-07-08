import { BaseOutputPlugin } from './BaseOutputPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface ConsoleOutputOptions {
  format?: 'json' | 'pretty' | 'compact';
  colorize?: boolean;
  timestamp?: boolean;
}

class ConsoleOutputPlugin extends BaseOutputPlugin {
  readonly name = 'ConsoleOutput';
  
  private format: 'json' | 'pretty' | 'compact';
  private colorize: boolean;
  private timestamp: boolean;

  constructor(options: ConsoleOutputOptions = {}) {
    super();
    this.format = options.format ?? 'json';
    this.colorize = options.colorize ?? true;
    this.timestamp = options.timestamp ?? true;
  }

  output(record: JsonlRecord): void {
    const output = this.formatOutput(record);
    console.log(output);
  }

  private formatOutput(record: JsonlRecord): string {
    let output = '';
    
    if (this.timestamp) {
      const timestamp = new Date().toISOString();
      output += this.colorize ? `\x1b[90m[${timestamp}]\x1b[0m ` : `[${timestamp}] `;
    }

    switch (this.format) {
      case 'pretty':
        output += JSON.stringify(record, null, 2);
        break;
      case 'compact':
        output += this.formatCompact(record);
        break;
      case 'json':
      default:
        output += JSON.stringify(record);
        break;
    }

    return output;
  }

  private formatCompact(record: JsonlRecord): string {
    const keys = Object.keys(record);
    const compactFields = keys.slice(0, 3).map(key => {
      const value = record[key];
      const displayValue = typeof value === 'string' && value.length > 20 
        ? value.substring(0, 20) + '...' 
        : value;
      return `${key}: ${displayValue}`;
    });

    if (keys.length > 3) {
      compactFields.push(`... (+${keys.length - 3} more)`);
    }

    return `{ ${compactFields.join(', ')} }`;
  }
}

export default ConsoleOutputPlugin;