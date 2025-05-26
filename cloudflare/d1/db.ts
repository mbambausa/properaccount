// cloudflare/d1/db.ts
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

export interface DbExecuteResult {
  success: boolean;
  error?: string; // With exactOptionalPropertyTypes, if 'error' exists, it must be a string.
  meta?: {
    duration?: number;
    changes?: number;
    last_row_id?: number; // D1Result meta uses last_row_id
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
      return result.results ?? []; // Ensure results is always an array
    } catch (error) {
      console.error('D1 query error:', error);
      throw error; // Or handle more gracefully, e.g., return empty array or custom error object
    }
  }

  async queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const statement = this.d1Instance.prepare(sql);
      // .first<T>() can return T or null if no row, or undefined if column doesn't exist (less likely with ORM)
      const result = await statement.bind(...params).first<T>();
      return result ?? null; // Coalesce to null explicitly
    } catch (error) {
      console.error('D1 queryOne error:', error);
      throw error; // Or handle by returning null or custom error
    }
  }

  async execute(sql: string, params: any[] = []): Promise<DbExecuteResult> {
    try {
      const statement = this.d1Instance.prepare(sql);
      const d1Result: D1Result = await statement.bind(...params).run();

      const response: DbExecuteResult = {
        success: d1Result.success,
        meta: {
          duration: d1Result.meta?.duration,
          changes: d1Result.meta?.changes,
          last_row_id: d1Result.meta?.last_row_id,
        }
      };

      if (!d1Result.success) {
        response.error = d1Result.error || 'Unknown D1 execute error';
      }
      
      return response;

    } catch (error) {
      console.error('D1 execute error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage // 'error' property is present because success is false
      };
    }
  }

  async batch(statements: D1PreparedStatement[]): Promise<DbExecuteResult[]> {
    try {
      const d1Results: D1Result[] = await this.d1Instance.batch(statements);
      
      return d1Results.map(d1Result => {
        const responseItem: DbExecuteResult = {
          success: d1Result.success,
          meta: {
            duration: d1Result.meta?.duration,
            changes: d1Result.meta?.changes,
            last_row_id: d1Result.meta?.last_row_id,
          }
        };
        if (!d1Result.success) {
          responseItem.error = d1Result.error || 'Unknown D1 batch statement error';
        }
        return responseItem;
      });

    } catch (error) {
      console.error('D1 batch error (entire batch call failed):', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If the entire batch call fails, map each statement to an error result
      return statements.map(() => ({
        success: false,
        error: errorMessage // 'error' property is present
      }));
    }
  }
}

export function createDbClient(d1: D1Database): Database {
  return new D1Client(d1);
}