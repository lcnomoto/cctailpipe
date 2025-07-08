import { BaseFilterPlugin } from './BaseFilterPlugin.js';
import { JsonlRecord } from '../../types/index.js';

interface KeywordFilterOptions {
  keywords: string[];
  mode: 'include' | 'exclude';
  caseSensitive?: boolean;
  searchFields?: string[];
}

class KeywordFilterPlugin extends BaseFilterPlugin {
  readonly name = 'KeywordFilter';
  
  private keywords: string[];
  private mode: 'include' | 'exclude';
  private caseSensitive: boolean;
  private searchFields: string[];

  constructor(options: KeywordFilterOptions) {
    super();
    this.keywords = options.keywords;
    this.mode = options.mode;
    this.caseSensitive = options.caseSensitive ?? false;
    this.searchFields = options.searchFields ?? [];
  }

  filter(record: JsonlRecord): boolean {
    const searchText = this.getSearchText(record);
    const hasKeyword = this.keywords.some(keyword => 
      this.caseSensitive 
        ? searchText.includes(keyword)
        : searchText.toLowerCase().includes(keyword.toLowerCase())
    );

    return this.mode === 'include' ? hasKeyword : !hasKeyword;
  }

  private getSearchText(record: JsonlRecord): string {
    if (this.searchFields.length === 0) {
      return JSON.stringify(record);
    }

    return this.searchFields
      .map(field => this.getNestedValue(record, field))
      .filter(value => value !== undefined)
      .join(' ');
  }

  private getNestedValue(obj: any, path: string): string {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return '';
      }
      current = current[key];
    }
    
    return current?.toString() || '';
  }
}

export default KeywordFilterPlugin;