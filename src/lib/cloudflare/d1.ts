// src/lib/cloudflare/d1.ts
/**
 * D1 Database Helper Utilities
 *
 * This file contains utility functions for working with Cloudflare D1 databases.
 * It provides a simplified interface for common operations and transaction handling.
 */
import type { CloudflareEnv } from '../../env';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Sanitizes a SQL identifier (table or column name) to prevent SQL injection.
 * @param name - The identifier to sanitize
 * @returns The sanitized identifier
 */
function sanitizeIdentifier(name: string): string {
  // Only allow alphanumeric and underscore characters
  const saneName = name.replace(/[^a-zA-Z0-9_]/g, '');
  if (saneName !== name) {
    console.warn(`Sanitized identifier used: "${name}" became "${saneName}". Review for security implications.`);
  }
  return saneName;
}

/**
 * Execute database operations within a transaction.
 * All operations either succeed together or fail together.
 * * @param db - The D1 database instance
 * @param callback - Function containing DB operations to execute in the transaction
 * @returns The result of the callback function
 */
export async function executeTransaction<T>(
  db: D1Database,
  callback: (transactionDb: D1Database) => Promise<T>
): Promise<T> {
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

/**
 * Retrieves a single record by ID.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param id - The ID value
 * @param idField - The ID column name (default: 'id')
 * @returns The record or null if not found
 */
export async function getById<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  id: string | number,
  idField: string = 'id'
): Promise<T | null> {
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const query = `SELECT * FROM ${safeTable} WHERE ${safeIdField} = ?`;
  return await db.prepare(query).bind(id).first<T>();
}

/**
 * Inserts a new record into the database.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param data - The data to insert
 * @returns Object with the inserted ID and success status
 */
export async function insert(
  db: D1Database,
  table: string,
  data: Record<string, any>
): Promise<{ id: string | number | undefined; success: boolean }> {
  const safeTable = sanitizeIdentifier(table);
  const columns = Object.keys(data).map(sanitizeIdentifier);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);
  
  if (columns.length === 0) {
    throw new Error('No data provided for insert operation');
  }
  
  const query = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(query).bind(...values);
  const result = await stmt.run();
  
  let insertedId: string | number | undefined;
  if (typeof data.id === 'string' || typeof data.id === 'number') {
    insertedId = data.id;
  } else if (result.meta?.last_row_id) {
    insertedId = result.meta.last_row_id;
  }
  
  return { id: insertedId, success: result.success };
}

/**
 * Updates an existing record in the database.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param id - The ID of the record to update
 * @param data - The data to update
 * @param idField - The ID column name (default: 'id')
 * @returns Object with success status and number of changed records
 */
export async function update(
  db: D1Database,
  table: string,
  id: string | number,
  data: Record<string, any>,
  idField: string = 'id'
): Promise<{ success: boolean; changes: number }> {
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const columnsToUpdate = Object.keys(data).map(sanitizeIdentifier);
  
  if (columnsToUpdate.length === 0) {
    return { success: true, changes: 0 };
  }
  
  const setClauses = columnsToUpdate.map(col => `${col} = ?`).join(', ');
  const values = [...Object.values(data), id];
  const query = `UPDATE ${safeTable} SET ${setClauses} WHERE ${safeIdField} = ?`;
  const stmt = db.prepare(query).bind(...values);
  const result = await stmt.run();
  
  return { 
    success: result.success, 
    changes: result.meta?.changes || 0 
  };
}

/**
 * Deletes a record by ID.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param id - The ID of the record to delete
 * @param idField - The ID column name (default: 'id')
 * @returns Object with success status and number of deleted records
 */
export async function deleteById(
  db: D1Database,
  table: string,
  id: string | number,
  idField: string = 'id'
): Promise<{ success: boolean; changes: number }> {
  const safeTable = sanitizeIdentifier(table);
  const safeIdField = sanitizeIdentifier(idField);
  const query = `DELETE FROM ${safeTable} WHERE ${safeIdField} = ?`;
  const stmt = db.prepare(query).bind(id);
  const result = await stmt.run();
  
  return { 
    success: result.success, 
    changes: result.meta?.changes || 0 
  };
}

/**
 * Retrieves multiple records with filtering and pagination.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param options - Query options (where, params, orderBy, limit, offset)
 * @returns Object with data, total count, and hasMore flag
 */
export async function getMany<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  options: {
    where?: string; 
    params?: unknown[]; 
    orderBy?: string; 
    limit?: number; 
    offset?: number;
  } = {}
): Promise<{ data: T[]; total: number; hasMore: boolean }> {
  const safeTable = sanitizeIdentifier(table);
  const { 
    where = '', 
    params = [], 
    orderBy = '', 
    limit = 50, 
    offset = 0 
  } = options;
  
  const whereClause = where ? `WHERE ${where}` : '';
  const orderByClause = orderBy ? `ORDER BY ${orderBy}` : '';
  const queryLimit = limit + 1;
  
  const query = `SELECT * FROM ${safeTable} ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
  const stmt = db.prepare(query).bind(...params, queryLimit, offset);
  const queryResults = (await stmt.all<T>()).results || [];
  
  const hasMore = queryResults.length > limit;
  const data = hasMore ? queryResults.slice(0, limit) : queryResults;
  
  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`;
  const countStmt = db.prepare(countQuery).bind(...params);
  const countResult = await countStmt.first<{ total: number }>();
  const total = countResult?.total || 0;
  
  return { data, total, hasMore };
}

/**
 * Checks if records matching a condition exist.
 * * @param db - The D1 database instance
 * @param table - The table name
 * @param where - The WHERE clause
 * @param params - Query parameters
 * @returns True if matching records exist
 */
export async function exists(
  db: D1Database,
  table: string,
  where: string,
  params: unknown[] = []
): Promise<boolean> {
  const safeTable = sanitizeIdentifier(table);
  const query = `SELECT 1 FROM ${safeTable} WHERE ${where} LIMIT 1`;
  const stmt = db.prepare(query).bind(...params);
  const result = await stmt.first<{ '1': number }>();
  return !!result;
}

/**
 * Gets a D1 database instance for a specific entity.
 * Implements the database-per-tenant model from the project plan.
 * * @param env - The Cloudflare environment
 * @param entityId - The entity ID
 * @returns The D1 database instance for the entity
 */
export async function getEntityDatabase(
  env: CloudflareEnv,
  entityId: string
): Promise<D1Database> {
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

/**
 * Creates a new D1 database for an entity.
 * Note: This is a placeholder - actual implementation requires Cloudflare API.
 * * @param env - The Cloudflare environment
 * @param entityId - The entity ID
 */
export async function createEntityDatabase(
  _env: CloudflareEnv,
  entityId: string
): Promise<void> {
  // In a real implementation, this would use the Cloudflare API to 
  // provision a new D1 database and update bindings
  console.warn(`Placeholder: createEntityDatabase for entity: ${entityId}. Actual provisioning requires Cloudflare API.`);
  
  // Implementation would include:
  // 1. Create a new D1 database via Cloudflare API
  // 2. Run migrations on the new database 
  // 3. Update wrangler.toml or environment variables
  // 4. Reload bindings
}