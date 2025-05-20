// src/lib/services/entity-service.ts
/**
 * Service for managing entities (i.e., companies, properties, or other organizational units)
 * in a multi-tenant environment. Handles entity creation, management, and account setup.
 */

import type { Entity, EntityInput, EntityQueryParams, EntityWithChildren } from '../../types/entity';
import type { ChartOfAccountsItemDefinition } from '../accounting/chartOfAccounts';
import { getDefaultChartOfAccounts } from '../accounting/chartOfAccounts';
import { DbEntity } from '@db/schema';

/**
 * Creates a new entity with default chart of accounts.
 * @param input Entity creation input
 * @param userId ID of the user creating the entity
 * @param env Cloudflare environment bindings
 * @returns The created entity
 */
export async function createEntityWithAccounts(
  input: EntityInput,
  userId: string,
  env: Record<string, any>
): Promise<Entity> {
  // First, create the entity
  const entity = await createEntity(input, userId, env);
  
  // Then, set up default accounts
  await setupEntityAccounts(entity.id, userId, env);
  
  return entity;
}

/**
 * Creates a new entity without accounts.
 * @param input Entity creation input
 * @param userId ID of the user creating the entity
 * @param env Cloudflare environment bindings
 * @returns The created entity
 */
export async function createEntity(
  input: EntityInput,
  userId: string,
  env: Record<string, any>
): Promise<Entity> {
  if (!input.name) {
    throw new Error('Entity name is required');
  }
  
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const entityId = crypto.randomUUID();
  
  const dbEntity: DbEntity = {
    id: entityId,
    user_id: userId,
    name: input.name,
    legal_name: input.legal_name || null,
    ein: input.ein || null,
    address: input.address || null,
    legal_address: input.legal_address || null,
    business_type: input.business_type || null,
    parent_id: input.parent_id || null,
    is_active: input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1,
    allows_sub_entities: input.allows_sub_entities !== undefined ? (input.allows_sub_entities ? 1 : 0) : 0,
    created_at: now,
    updated_at: now
  };
  
  // Insert into database
  const db = env.DATABASE;
  
  try {
    await db.prepare(`
      INSERT INTO entities (
        id, user_id, name, legal_name, ein, address, legal_address, 
        business_type, parent_id, is_active, allows_sub_entities, 
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      dbEntity.id,
      dbEntity.user_id,
      dbEntity.name,
      dbEntity.legal_name,
      dbEntity.ein,
      dbEntity.address,
      dbEntity.legal_address,
      dbEntity.business_type,
      dbEntity.parent_id,
      dbEntity.is_active,
      dbEntity.allows_sub_entities,
      dbEntity.created_at,
      dbEntity.updated_at
    ).run();
    
    // Create entity path for hierarchical navigation
    let path = dbEntity.name;
    
    if (dbEntity.parent_id) {
      const parentEntity = await getEntity(dbEntity.parent_id, userId, env);
      if (parentEntity && parentEntity.path) {
        path = `${parentEntity.path}/${dbEntity.name}`;
      }
    }
    
    // Return the entity with boolean conversions and path
    return {
      ...dbEntity,
      is_active: dbEntity.is_active === 1,
      allows_sub_entities: dbEntity.allows_sub_entities === 1,
      path
    };
  } catch (error) {
    console.error('Error creating entity:', error);
    throw new Error(`Failed to create entity: ${error.message}`);
  }
}

/**
 * Sets up default chart of accounts for an entity.
 * @param entityId ID of the entity 
 * @param userId ID of the user
 * @param env Cloudflare environment bindings
 */
export async function setupEntityAccounts(
  entityId: string,
  userId: string,
  env: Record<string, any>
): Promise<void> {
  // Get default chart of accounts
  const defaultAccounts = getDefaultChartOfAccounts();
  
  // Create entity accounts for each default account
  const db = env.DATABASE;
  const now = Math.floor(Date.now() / 1000);
  
  // First, ensure all accounts exist in the chart_of_accounts table
  await ensureChartOfAccounts(defaultAccounts, userId, env);
  
  // Then create entity-specific accounts
  try {
    // Start a transaction
    await db.exec('BEGIN TRANSACTION');
    
    for (const account of defaultAccounts) {
      // Find or create the chart of account entry
      const chartAccount = await db.prepare(`
        SELECT id FROM chart_of_accounts 
        WHERE user_id = ? AND code = ?
      `).bind(userId, account.code).first();
      
      if (!chartAccount) {
        console.warn(`Chart of account not found for code ${account.code}`);
        continue;
      }
      
      // Create entity account linking the entity to this account
      const entityAccountId = crypto.randomUUID();
      
      await db.prepare(`
        INSERT INTO entity_accounts (
          id, user_id, entity_id, account_id, custom_name,
          is_active, recovery_type, recovery_percentage,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entityAccountId,
        userId,
        entityId,
        chartAccount.id,
        null, // No custom name
        1, // Active by default
        account.isRecoverable ? 'standard' : null,
        account.isRecoverable ? 10000 : null, // 100.00% as basis points
        now,
        now
      ).run();
    }
    
    // Commit the transaction
    await db.exec('COMMIT');
  } catch (error) {
    // Rollback on error
    try {
      await db.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    console.error('Error setting up entity accounts:', error);
    throw new Error(`Failed to set up entity accounts: ${error.message}`);
  }
}

/**
 * Ensures all accounts exist in the chart_of_accounts table.
 * @param accounts Default account definitions
 * @param userId User ID
 * @param env Cloudflare environment bindings
 */
async function ensureChartOfAccounts(
  accounts: ChartOfAccountsItemDefinition[],
  userId: string,
  env: Record<string, any>
): Promise<void> {
  const db = env.DATABASE;
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Start a transaction
    await db.exec('BEGIN TRANSACTION');
    
    for (const account of accounts) {
      // Check if account already exists
      const existingAccount = await db.prepare(`
        SELECT id FROM chart_of_accounts 
        WHERE user_id = ? AND code = ?
      `).bind(userId, account.code).first();
      
      if (!existingAccount) {
        // Create chart of account entry
        const accountId = crypto.randomUUID();
        
        await db.prepare(`
          INSERT INTO chart_of_accounts (
            id, user_id, code, name, type, subtype, description,
            is_recoverable, recovery_percentage, is_active,
            tax_category, parent_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          accountId,
          userId,
          account.code,
          account.name,
          account.type,
          account.subtype || null,
          account.description || null,
          account.isRecoverable ? 1 : 0,
          account.isRecoverable ? 10000 : null, // 100.00% as basis points
          1, // Active by default
          null, // No tax category by default
          null, // Parent ID will be set after all accounts are created
          now,
          now
        ).run();
      }
    }
    
    // Set parent relationships
    for (const account of accounts) {
      if (account.parentCode) {
        // Find the account and its parent
        const accountRow = await db.prepare(`
          SELECT id FROM chart_of_accounts 
          WHERE user_id = ? AND code = ?
        `).bind(userId, account.code).first();
        
        const parentRow = await db.prepare(`
          SELECT id FROM chart_of_accounts 
          WHERE user_id = ? AND code = ?
        `).bind(userId, account.parentCode).first();
        
        if (accountRow && parentRow) {
          // Update parent relationship
          await db.prepare(`
            UPDATE chart_of_accounts 
            SET parent_id = ?, updated_at = ? 
            WHERE id = ?
          `).bind(parentRow.id, now, accountRow.id).run();
        }
      }
    }
    
    // Commit the transaction
    await db.exec('COMMIT');
  } catch (error) {
    // Rollback on error
    try {
      await db.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    console.error('Error ensuring chart of accounts:', error);
    throw new Error(`Failed to ensure chart of accounts: ${error.message}`);
  }
}

/**
 * Gets an entity by ID.
 * @param entityId Entity ID
 * @param userId User ID (for access control)
 * @param env Cloudflare environment bindings
 * @returns The entity if found and accessible
 */
export async function getEntity(
  entityId: string,
  userId: string,
  env: Record<string, any>
): Promise<Entity | null> {
  const db = env.DATABASE;
  
  try {
    const entity = await db.prepare(`
      SELECT * FROM entities 
      WHERE id = ? AND user_id = ?
    `).bind(entityId, userId).first();
    
    if (!entity) {
      return null;
    }
    
    // Build path for hierarchical navigation
    let path = entity.name;
    
    if (entity.parent_id) {
      const parentEntity = await getEntity(entity.parent_id, userId, env);
      if (parentEntity && parentEntity.path) {
        path = `${parentEntity.path}/${entity.name}`;
      }
    }
    
    // Convert database integers to booleans
    return {
      ...entity,
      is_active: entity.is_active === 1,
      allows_sub_entities: entity.allows_sub_entities === 1,
      path
    };
  } catch (error) {
    console.error('Error getting entity:', error);
    throw new Error(`Failed to get entity: ${error.message}`);
  }
}

/**
 * Gets all entities for a user.
 * @param userId User ID
 * @param params Query parameters for filtering
 * @param env Cloudflare environment bindings
 * @returns Array of entities matching the criteria
 */
export async function getEntities(
  userId: string,
  params: EntityQueryParams = {},
  env: Record<string, any>
): Promise<Entity[]> {
  const db = env.DATABASE;
  
  // Build WHERE clause based on parameters
  let whereClause = 'user_id = ?';
  const bindParams: any[] = [userId];
  
  if (params.active_only) {
    whereClause += ' AND is_active = 1';
  }
  
  if (params.parent_only) {
    whereClause += ' AND allows_sub_entities = 1';
  }
  
  if (params.parent_id) {
    whereClause += ' AND parent_id = ?';
    bindParams.push(params.parent_id);
  } else if (params.parent_id === null) {
    whereClause += ' AND parent_id IS NULL';
  }
  
  if (params.business_type) {
    whereClause += ' AND business_type = ?';
    bindParams.push(params.business_type);
  }
  
  if (params.search) {
    whereClause += ' AND (name LIKE ? OR legal_name LIKE ?)';
    const searchTerm = `%${params.search}%`;
    bindParams.push(searchTerm, searchTerm);
  }
  
  try {
    const entities = await db.prepare(`
      SELECT * FROM entities 
      WHERE ${whereClause}
      ORDER BY name
    `).bind(...bindParams).all();
    
    // Convert integers to booleans
    return entities.results.map(entity => ({
      ...entity,
      is_active: entity.is_active === 1,
      allows_sub_entities: entity.allows_sub_entities === 1
    }));
  } catch (error) {
    console.error('Error getting entities:', error);
    throw new Error(`Failed to get entities: ${error.message}`);
  }
}

/**
 * Gets a hierarchical representation of entities.
 * @param userId User ID
 * @param params Query parameters
 * @param env Cloudflare environment bindings
 * @returns Hierarchical structure of entities
 */
export async function getEntityHierarchy(
  userId: string,
  params: EntityQueryParams = {},
  env: Record<string, any>
): Promise<EntityWithChildren[]> {
  // Get all entities
  const allEntities = await getEntities(userId, params, env);
  
  // Build parent-child relationships
  const entityMap = new Map<string, EntityWithChildren>();
  const rootEntities: EntityWithChildren[] = [];
  
  // First pass: create entity map with empty children arrays
  allEntities.forEach(entity => {
    entityMap.set(entity.id, { ...entity, children: [], depth: 0 });
  });
  
  // Second pass: populate children arrays and identify root entities
  allEntities.forEach(entity => {
    const entityWithChildren = entityMap.get(entity.id)!;
    
    if (entity.parent_id && entityMap.has(entity.parent_id)) {
      // Add to parent's children
      const parent = entityMap.get(entity.parent_id)!;
      parent.children!.push(entityWithChildren);
      
      // Set depth (parent's depth + 1)
      entityWithChildren.depth = (parent.depth || 0) + 1;
    } else {
      // Root entity (no parent or parent not in filtered set)
      rootEntities.push(entityWithChildren);
    }
  });
  
  return rootEntities;
}

/**
 * Updates an entity.
 * @param entityId Entity ID
 * @param updates Updates to apply
 * @param userId User ID (for access control)
 * @param env Cloudflare environment bindings
 * @returns The updated entity
 */
export async function updateEntity(
  entityId: string,
  updates: Partial<EntityInput>,
  userId: string,
  env: Record<string, any>
): Promise<Entity> {
  const db = env.DATABASE;
  
  // Get existing entity to verify access and merge updates
  const existingEntity = await getEntity(entityId, userId, env);
  
  if (!existingEntity) {
    throw new Error('Entity not found or access denied');
  }
  
  // Build update statement
  const updateFields: string[] = [];
  const bindParams: any[] = [];
  
  if (updates.name !== undefined) {
    updateFields.push('name = ?');
    bindParams.push(updates.name);
  }
  
  if (updates.legal_name !== undefined) {
    updateFields.push('legal_name = ?');
    bindParams.push(updates.legal_name);
  }
  
  if (updates.ein !== undefined) {
    updateFields.push('ein = ?');
    bindParams.push(updates.ein);
  }
  
  if (updates.address !== undefined) {
    updateFields.push('address = ?');
    bindParams.push(updates.address);
  }
  
  if (updates.legal_address !== undefined) {
    updateFields.push('legal_address = ?');
    bindParams.push(updates.legal_address);
  }
  
  if (updates.business_type !== undefined) {
    updateFields.push('business_type = ?');
    bindParams.push(updates.business_type);
  }
  
  if (updates.parent_id !== undefined) {
    // Prevent circular references
    if (updates.parent_id === entityId) {
      throw new Error('Entity cannot be its own parent');
    }
    
    // Check if the new parent exists and is valid
    if (updates.parent_id) {
      const parent = await getEntity(updates.parent_id, userId, env);
      
      if (!parent) {
        throw new Error('Parent entity not found or access denied');
      }
      
      if (!parent.allows_sub_entities) {
        throw new Error('Selected parent entity does not allow sub-entities');
      }
      
      // Verify this wouldn't create a circular reference
      let currentParent = parent;
      while (currentParent.parent_id) {
        if (currentParent.parent_id === entityId) {
          throw new Error('Cannot create circular hierarchy');
        }
        currentParent = await getEntity(currentParent.parent_id, userId, env) as Entity;
        if (!currentParent) break;
      }
    }
    
    updateFields.push('parent_id = ?');
    bindParams.push(updates.parent_id);
  }
  
  if (updates.is_active !== undefined) {
    updateFields.push('is_active = ?');
    bindParams.push(updates.is_active ? 1 : 0);
  }
  
  if (updates.allows_sub_entities !== undefined) {
    updateFields.push('allows_sub_entities = ?');
    bindParams.push(updates.allows_sub_entities ? 1 : 0);
  }
  
  // Add updated_at field
  const now = Math.floor(Date.now() / 1000);
  updateFields.push('updated_at = ?');
  bindParams.push(now);
  
  // Add entity ID and user ID to bind parameters
  bindParams.push(entityId, userId);
  
  if (updateFields.length === 0) {
    // No updates to apply
    return existingEntity;
  }
  
  try {
    // Execute update
    await db.prepare(`
      UPDATE entities 
      SET ${updateFields.join(', ')} 
      WHERE id = ? AND user_id = ?
    `).bind(...bindParams).run();
    
    // Get the updated entity
    const updatedEntity = await getEntity(entityId, userId, env);
    
    if (!updatedEntity) {
      throw new Error('Failed to retrieve updated entity');
    }
    
    return updatedEntity;
  } catch (error) {
    console.error('Error updating entity:', error);
    throw new Error(`Failed to update entity: ${error.message}`);
  }
}

/**
 * Deletes an entity.
 * @param entityId Entity ID
 * @param userId User ID (for access control)
 * @param env Cloudflare environment bindings
 * @returns True if successfully deleted
 */
export async function deleteEntity(
  entityId: string,
  userId: string,
  env: Record<string, any>
): Promise<boolean> {
  const db = env.DATABASE;
  
  // Get existing entity to verify access
  const existingEntity = await getEntity(entityId, userId, env);
  
  if (!existingEntity) {
    throw new Error('Entity not found or access denied');
  }
  
  // Check if entity has children
  const children = await db.prepare(`
    SELECT COUNT(*) as count FROM entities 
    WHERE parent_id = ? AND user_id = ?
  `).bind(entityId, userId).first();
  
  if (children && children.count > 0) {
    throw new Error('Cannot delete entity with children');
  }
  
  // Check if entity has transactions or other dependent records
  const transactions = await db.prepare(`
    SELECT COUNT(*) as count FROM transactions 
    WHERE entity_id = ? AND user_id = ?
  `).bind(entityId, userId).first();
  
  if (transactions && transactions.count > 0) {
    throw new Error('Cannot delete entity with transactions. Consider marking it as inactive instead.');
  }
  
  try {
    // Delete entity accounts first
    await db.prepare(`
      DELETE FROM entity_accounts 
      WHERE entity_id = ? AND user_id = ?
    `).bind(entityId, userId).run();
    
    // Then delete the entity
    const result = await db.prepare(`
      DELETE FROM entities 
      WHERE id = ? AND user_id = ?
    `).bind(entityId, userId).run();
    
    return result.success;
  } catch (error) {
    console.error('Error deleting entity:', error);
    throw new Error(`Failed to delete entity: ${error.message}`);
  }
}