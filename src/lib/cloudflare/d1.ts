// src/lib/cloudflare/d1.ts
/**
 * D1 Database Helper Utilities
 *
 * This file contains utility functions for working with Cloudflare D1 databases.
 * It provides a simplified interface for common operations and transaction handling.
 */
import type { CloudflareEnv } from '@/env'; // Import CloudflareEnv

function sanitizeIdentifier(name: string): string {
  // ... (implementation remains the same)
  const saneName = name.replace(/[^a-zA-Z0-9_]/g, '');
  if (saneName !== name) {
    console.warn(`Sanitized identifier used: "${name}" became "${saneName}". Review for security implications.`);
  }
  return saneName;
}

export async function executeTransaction<T>(
  db: D1Database,
  callback: (transactionDb: D1Database) => Promise<T>
): Promise<T> {
  // ... (implementation remains the same)
  try {
    await db.prepare('BEGIN').run();
    const result = await callback(db);
    await db.prepare('COMMIT').run();
    return result;
  } catch (error) {
    try {
      await db.prepare('ROLLBACK').run();
    } catch (rollbackError) {
      console.error('Error rolling back D1 transaction:', rollbackError, 'Original error:', error);
    }
    throw error;
  }
}

export async function getById<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  id: string | number,
  idField: string = 'id'
): Promise<T | null> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const query = `SELECT * FROM ${safeTable} WHERE ${safeIdField} = ?`;
  return await db.prepare(query).bind(id).first<T>();
}

export async function insert(
  db: D1Database,
  table: string,
  data: Record<string, any>
): Promise<{ id: string | number | undefined; success: boolean }> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const columns = Object.keys(data).map(sanitizeIdentifier);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);
  const query = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(query).bind(...values);
  const result = await stmt.run();
  let insertedId: string | number | undefined;
  if (typeof data.id === 'string' || typeof data.id === 'number') {
    insertedId = data.id;
  } else if (result.meta.last_row_id) {
    insertedId = result.meta.last_row_id;
  }
  return { id: insertedId, success: result.success };
}

export async function update(
  db: D1Database,
  table: string,
  id: string | number,
  data: Record<string, any>,
  idField: string = 'id'
): Promise<{ success: boolean; changes: number }> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const columnsToUpdate = Object.keys(data).map(sanitizeIdentifier);
  if (columnsToUpdate.length === 0) return { success: true, changes: 0 };
  const setClauses = columnsToUpdate.map(col => `${col} = ?`).join(', ');
  const values = [...Object.values(data), id];
  const query = `UPDATE ${safeTable} SET ${setClauses} WHERE ${safeIdField} = ?`;
  const stmt = db.prepare(query).bind(...values);
  const result = await stmt.run();
  return { success: result.success, changes: result.meta?.changes || 0 };
}

export async function deleteById(
  db: D1Database,
  table: string,
  id: string | number,
  idField: string = 'id'
): Promise<{ success: boolean; changes: number }> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const query = `DELETE FROM ${safeTable} WHERE ${safeIdField} = ?`;
  const stmt = db.prepare(query).bind(id);
  const result = await stmt.run();
  return { success: result.success, changes: result.meta?.changes || 0 };
}

export async function getMany<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  options: {
    where?: string; params?: unknown[]; orderBy?: string; limit?: number; offset?: number;
  } = {}
): Promise<{ data: T[]; total: number; hasMore: boolean }> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const { where = '', params = [], orderBy = '', limit = 50, offset = 0 } = options;
  const whereClause = where ? `WHERE ${where}` : '';
  const orderByClause = orderBy ? `ORDER BY ${orderBy}` : '';
  const queryLimit = limit + 1;
  const query = `SELECT * FROM ${safeTable} ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
  const stmt = db.prepare(query).bind(...params, queryLimit, offset);
  const queryResults = (await stmt.all<T>()).results || [];
  const hasMore = queryResults.length > limit;
  const data = hasMore ? queryResults.slice(0, limit) : queryResults;
  const countQuery = `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`;
  const countStmt = db.prepare(countQuery).bind(...params);
  const countResult = await countStmt.first<{ total: number }>();
  const total = countResult?.total || 0;
  return { data, total, hasMore };
}

export async function exists(
  db: D1Database,
  table: string,
  where: string,
  params: unknown[] = []
): Promise<boolean> {
  // ... (implementation remains the same)
  const safeTable = sanitizeIdentifier(table);
  const query = `SELECT 1 FROM ${safeTable} WHERE ${where} LIMIT 1`;
  const stmt = db.prepare(query).bind(...params);
  const result = await stmt.first<{ '1': number }>();
  return !!result;
}

export async function getEntityDatabase(
  env: CloudflareEnv, // This now refers to the imported CloudflareEnv
  entityId: string
): Promise<D1Database> {
  // ... (implementation remains the same)
  const safeEntityId = sanitizeIdentifier(entityId);
  const dbBindingKey = `DATABASE_${safeEntityId}`;
  if (dbBindingKey in env && (env as Record<string, any>)[dbBindingKey]) {
    return (env as Record<string, any>)[dbBindingKey] as D1Database;
  }
  if (env.DATABASE) {
    console.warn(`Specific D1 binding "${dbBindingKey}" not found. Falling back to shared 'DATABASE' binding for entity ${entityId}.`);
    return env.DATABASE;
  }
  throw new Error(`Database binding not found for entity: ${entityId}, and no default 'DATABASE' binding available.`);
}

export async function createEntityDatabase(
  _env: CloudflareEnv, // This now refers to the imported CloudflareEnv
  entityId: string
): Promise<void> {
  // ... (implementation remains the same)
  console.warn(`Placeholder: createEntityDatabase for entity: ${entityId}. Actual provisioning requires Cloudflare API.`);
}