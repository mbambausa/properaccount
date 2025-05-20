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
      const result = await statement.bind(...params).run();
      
      return {
        success: true,
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
      const results = await this.d1Instance.batch(statements);
      return results.map(result => ({
        success: true,
        meta: {
          duration: result.meta?.duration,
          changes: result.meta?.changes,
          last_row_id: result.meta?.last_row_id
        }
      }));
    } catch (error) {
      console.error('D1 batch error:', error);
      // Return results with error for all statements
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