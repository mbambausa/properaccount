// cloudflare/d1/db.ts
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

export interface DbExecuteResult {
  success: boolean;
  error?: string;
  meta?: {
    duration?: number;
    changes?: number;
    last_row_id?: number;
  };
}

export interface Database {
  d1Instance: D1Database;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<DbExecuteResult>;
  batch(statements: D1PreparedStatement[]): Promise<DbExecuteResult[]>;
}

class D1Client implements Database {
  public d1Instance: D1Database;

  constructor(d1: D1Database) {
    this.d1Instance = d1;
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const statement = this.d1Instance.prepare(sql);
      const result = await statement.bind(...params).all<T>();
      return result.results;
    } catch (error) {
      console.error('D1 query error:', error);
      throw error;
    }
  }

  async queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const statement = this.d1Instance.prepare(sql);
      const result = await statement.bind(...params).first<T>();
      return result || null;
    } catch (error) {
      console.error('D1 queryOne error:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<DbExecuteResult> {
    try {
      const statement = this.d1Instance.prepare(sql);
      const result: D1Result = await statement.bind(...params).run(); // Explicitly type result
      
      return {
        success: result.success, // Use D1Result's success field
        error: result.success ? undefined : (result.error || 'Unknown D1 execute error'), // Provide error if not successful
        meta: {
          duration: result.meta?.duration,
          changes: result.meta?.changes,
          last_row_id: result.meta?.last_row_id
        }
      };
    } catch (error) {
      console.error('D1 execute error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async batch(statements: D1PreparedStatement[]): Promise<DbExecuteResult[]> {
    try {
      const results: D1Result[] = await this.d1Instance.batch(statements); // Explicitly type results
      return results.map(result => ({
        success: result.success, // Use D1Result's success field for each statement
        error: result.success ? undefined : (result.error || 'Unknown D1 batch statement error'), // Provide error if not successful
        meta: {
          duration: result.meta?.duration,
          changes: result.meta?.changes,
          last_row_id: result.meta?.last_row_id
        }
      }));
    } catch (error) {
      console.error('D1 batch error (entire batch call failed):', error);
      return statements.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}

export function createDbClient(d1: D1Database): Database {
  return new D1Client(d1);
}