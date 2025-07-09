import { BaseFilterPlugin } from './BaseFilterPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface FieldMatchFilterOptions {
  field: string;  // チェックするフィールド名（ネストも対応: "user.name"）
  value: unknown;     // マッチさせる値
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'regex';
  caseSensitive?: boolean;
  mode?: 'include' | 'exclude';  // includeなら一致したものを通す、excludeなら一致したものを除外
}

class FieldMatchFilterPlugin extends BaseFilterPlugin {
  readonly name = 'FieldMatchFilter';
  
  private field: string;
  private value: unknown;
  private operator: string;
  private caseSensitive: boolean;
  private mode: 'include' | 'exclude';

  constructor(options: FieldMatchFilterOptions) {
    super();
    this.field = options.field;
    this.value = options.value;
    this.operator = options.operator ?? 'equals';
    this.caseSensitive = options.caseSensitive ?? true;
    this.mode = options.mode ?? 'include';
  }

  filter(record: JsonlRecord): boolean {
    const fieldValue = this.getNestedValue(record, this.field);
    const matches = this.checkMatch(fieldValue, this.value);
    
    return this.mode === 'include' ? matches : !matches;
  }

  private checkMatch(fieldValue: unknown, targetValue: unknown): boolean {
    // undefined/nullの処理
    if (fieldValue === undefined || fieldValue === null) {
      return targetValue === fieldValue;
    }

    switch (this.operator) {
      case 'equals':
        return this.checkEquals(fieldValue, targetValue);
      
      case 'contains':
        return this.checkContains(fieldValue, targetValue);
      
      case 'startsWith':
        return this.checkStartsWith(fieldValue, targetValue);
      
      case 'endsWith':
        return this.checkEndsWith(fieldValue, targetValue);
      
      case 'gt':
        return Number(fieldValue) > Number(targetValue);
      
      case 'gte':
        return Number(fieldValue) >= Number(targetValue);
      
      case 'lt':
        return Number(fieldValue) < Number(targetValue);
      
      case 'lte':
        return Number(fieldValue) <= Number(targetValue);
      
      case 'regex':
        return new RegExp(String(targetValue), this.caseSensitive ? '' : 'i').test(String(fieldValue));
      
      default:
        return false;
    }
  }

  private checkEquals(fieldValue: unknown, targetValue: unknown): boolean {
    if (typeof fieldValue === 'string' && typeof targetValue === 'string' && !this.caseSensitive) {
      return fieldValue.toLowerCase() === targetValue.toLowerCase();
    }
    return fieldValue === targetValue;
  }

  private checkContains(fieldValue: unknown, targetValue: unknown): boolean {
    const fieldStr = String(fieldValue);
    const targetStr = String(targetValue);
    
    if (!this.caseSensitive) {
      return fieldStr.toLowerCase().includes(targetStr.toLowerCase());
    }
    return fieldStr.includes(targetStr);
  }

  private checkStartsWith(fieldValue: unknown, targetValue: unknown): boolean {
    const fieldStr = String(fieldValue);
    const targetStr = String(targetValue);
    
    if (!this.caseSensitive) {
      return fieldStr.toLowerCase().startsWith(targetStr.toLowerCase());
    }
    return fieldStr.startsWith(targetStr);
  }

  private checkEndsWith(fieldValue: unknown, targetValue: unknown): boolean {
    const fieldStr = String(fieldValue);
    const targetStr = String(targetValue);
    
    if (!this.caseSensitive) {
      return fieldStr.toLowerCase().endsWith(targetStr.toLowerCase());
    }
    return fieldStr.endsWith(targetStr);
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
}

export default FieldMatchFilterPlugin;