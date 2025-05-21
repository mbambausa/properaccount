// src/lib/services/entity-service.ts
import type { D1Database } from '@cloudflare/workers-types';
import { createDbClient, type Database, type DbExecuteResult } from '@db/db';
import type { DbEntity } from '@db/schema';
import type { Entity, EntityInput, EntityWithChildren, EntityQueryFilters, EntityType } from '../../types/entity';
import { AppError, ValidationError, NotFoundError } from '../../utils/errors';
import { createAccountService } from './account-service';
import { createEntityAccountService } from './entity-account-service';

// Helper to map DbEntity to application-level Entity type
function mapDbEntityToAppEntity(dbEntity: DbEntity, path?: string | null): Entity {
  return {
    id: dbEntity.id,
    created_by_user_id: dbEntity.user_id,
    name: dbEntity.name,
    legal_name: dbEntity.legal_name || undefined,
    tax_id: dbEntity.ein || undefined,
    address: dbEntity.address || undefined,
    // FIXED: Removed legal_address which doesn't exist in Entity type
    type: (dbEntity.business_type as EntityType) || 'company',
    parent_id: dbEntity.parent_id || undefined,
    is_active: dbEntity.is_active === 1,
    // FIXED: Removed allows_sub_entities if it doesn't exist in Entity
    created_at: dbEntity.created_at,
    updated_at: dbEntity.updated_at,
    path: path || dbEntity.name,
  };
}

export class EntityService {
  private db: Database;

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
  }

  async createEntityAndSetupAccounts(input: EntityInput, userId: string): Promise<Entity> {
    const entity = await this.createEntity(input, userId);

    const accountService = createAccountService(this.db.d1Instance);
    const entityAccountService = createEntityAccountService(this.db.d1Instance);

    try {
      await accountService.initializeDefaultAccounts(userId);
      await entityAccountService.initializeEntityAccounts(entity.id, userId);
    } catch (setupError: unknown) {
      console.error(`Failed to setup default accounts for new entity ${entity.id}:`, setupError);
    }
    return entity;
  }

  async createEntity(input: EntityInput, userId: string): Promise<Entity> {
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Entity name is required.');
    }

    const now = Math.floor(Date.now() / 1000);
    const entityId = crypto.randomUUID();

    // Map EntityInput to DbEntity structure
    const dbEntityData: Omit<DbEntity, 'created_at' | 'updated_at' | 'id'> & {id: string} = {
      id: entityId,
      user_id: userId,
      name: input.name.trim(),
      legal_name: input.legal_name || null,
      ein: input.tax_id || null,
      address: input.address || null,
      // FIXED: Removed legal_address
      legal_address: null, // Set to null as it exists in DbEntity but not in EntityInput
      business_type: input.type || null,
      parent_id: input.parent_id || null,
      is_active: input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1,
      // FIXED: Default allows_sub_entities
      allows_sub_entities: 0, // Default value since it's not in EntityInput
    };

    try {
      // FIXED: Changed executeD to execute
      await this.db.execute(
        `INSERT INTO entities (id, user_id, name, legal_name, ein, address, legal_address, business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
        [
          dbEntityData.id, dbEntityData.user_id, dbEntityData.name, dbEntityData.legal_name, dbEntityData.ein,
          dbEntityData.address, dbEntityData.legal_address, dbEntityData.business_type, dbEntityData.parent_id,
          dbEntityData.is_active, dbEntityData.allows_sub_entities, now
        ]
      );

      const newDbEntity = await this.db.queryOne<DbEntity>(
        `SELECT * FROM entities WHERE id = ?1 AND user_id = ?2`,
        [entityId, userId]
      );
      if (!newDbEntity) {
        throw new AppError("Failed to retrieve entity after creation.", 500);
      }
      return mapDbEntityToAppEntity(newDbEntity);
    } catch (error: unknown) {
      console.error('Error creating entity:', error);
      const message = error instanceof Error ? error.message : 'Failed to create entity.';
      if (message.toUpperCase().includes('UNIQUE CONSTRAINT FAILED: ENTITIES.NAME')) {
          throw new ValidationError(`Entity name "${input.name}" already exists.`);
      }
      throw new AppError(message, 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getEntityById(entityId: string, userId: string): Promise<Entity | null> {
    try {
      const dbEntity = await this.db.queryOne<DbEntity>(
        `SELECT * FROM entities WHERE id = ?1 AND user_id = ?2`, [entityId, userId]
      );
      if (!dbEntity) return null;

      let path = dbEntity.name;
      let currentParentId = dbEntity.parent_id;
      const pathSegments: string[] = [dbEntity.name];
      while (currentParentId) {
          const parent = await this.db.queryOne<DbEntity>(
              `SELECT id, name, parent_id FROM entities WHERE id = ?1 AND user_id = ?2`,
              [currentParentId, userId]
          );
          if (parent) {
              pathSegments.unshift(parent.name);
              currentParentId = parent.parent_id;
          } else {
              break;
          }
      }
      path = pathSegments.join('/');

      return mapDbEntityToAppEntity(dbEntity, path);
    } catch (error: unknown) {
      console.error(`Error getting entity ${entityId}:`, error);
      throw new AppError('Failed to get entity.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getEntities(userId: string, params: EntityQueryFilters = {}): Promise<Entity[]> {
    let sql = `SELECT * FROM entities WHERE user_id = ?1`;
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (params.is_active !== undefined) {
      sql += ` AND is_active = ?${paramIndex++}`;
      queryParams.push(params.is_active ? 1 : 0);
    }
    if (params.search_term) {
      sql += ` AND (name LIKE ?${paramIndex} OR legal_name LIKE ?${paramIndex})`;
      queryParams.push(`%${params.search_term}%`);
      paramIndex++;
    }
    if (params.type) {
        sql += ` AND business_type = ?${paramIndex++}`;
        queryParams.push(params.type);
    }
    if (params.parent_id === null) {
        sql += ` AND parent_id IS NULL`;
    } else if (params.parent_id) {
        sql += ` AND parent_id = ?${paramIndex++}`;
        queryParams.push(params.parent_id);
    }

    sql += ` ORDER BY name`;
    try {
      const dbEntities = await this.db.query<DbEntity>(sql, queryParams);
      return dbEntities.map(dbE => mapDbEntityToAppEntity(dbE, dbE.name));
    } catch (error: unknown) {
      console.error('Error getting entities:', error);
      throw new AppError('Failed to get entities.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getEntityHierarchy(userId: string, params: EntityQueryFilters = {}): Promise<EntityWithChildren[]> {
    const allAppEntities = await this.getEntities(userId, params);

    const entityMap = new Map<string, EntityWithChildren>();
    const rootEntities: EntityWithChildren[] = [];

    allAppEntities.forEach(entity => {
      // FIXED: Removed depth property
      entityMap.set(entity.id, { ...entity, children: [] });
    });

    allAppEntities.forEach(entity => {
      const entityWithChildren = entityMap.get(entity.id)!;
      if (entity.parent_id && entityMap.has(entity.parent_id)) {
        const parent = entityMap.get(entity.parent_id)!;
        parent.children!.push(entityWithChildren);
        // FIXED: Removed depth property calculation
      } else {
        rootEntities.push(entityWithChildren);
      }
    });
    return rootEntities;
  }

  async updateEntity(entityId: string, updates: Partial<EntityInput>, userId: string): Promise<Entity> {
    const existingAppEntity = await this.getEntityById(entityId, userId);
    if (!existingAppEntity) throw new NotFoundError('Entity not found or access denied.');

    const updateFields: string[] = [];
    const bindParams: any[] = [];
    const now = Math.floor(Date.now() / 1000);

    let paramIndex = 1;
    const addUpdate = (dbKey: keyof DbEntity, appValue: any | undefined, existingValue: any) => {
        if (appValue !== undefined && (appValue !== existingValue || (appValue === null && existingValue !== null))) {
            updateFields.push(`${dbKey.toString()} = ?${paramIndex++}`);
            bindParams.push(appValue);
        }
    };

    addUpdate('name', updates.name?.trim(), existingAppEntity.name);
    addUpdate('legal_name', updates.legal_name, existingAppEntity.legal_name);
    addUpdate('ein', updates.tax_id, existingAppEntity.tax_id);
    addUpdate('address', updates.address, existingAppEntity.address);
    // FIXED: Removed legal_address
    addUpdate('business_type', updates.type, existingAppEntity.type);

    if (updates.parent_id !== undefined) {
      if (updates.parent_id === entityId) throw new ValidationError('Entity cannot be its own parent');
      if (updates.parent_id) { /* TODO: Validate parent & check cycles */ }
      addUpdate('parent_id', updates.parent_id, existingAppEntity.parent_id);
    }
    if (updates.is_active !== undefined) addUpdate('is_active', updates.is_active ? 1 : 0, existingAppEntity.is_active ? 1: 0);
    // FIXED: Removed allows_sub_entities

    if (updateFields.length === 0) return existingAppEntity;

    updateFields.push(`updated_at = ?${paramIndex++}`); 
    bindParams.push(now);
    
    const sql = `UPDATE entities SET ${updateFields.join(', ')} WHERE id = ?${paramIndex++} AND user_id = ?${paramIndex++}`;
    bindParams.push(entityId, userId);

    try {
      // FIXED: Changed executeD to execute
      await this.db.execute(sql, bindParams);
      const updatedEntity = await this.getEntityById(entityId, userId);
      if (!updatedEntity) throw new AppError('Failed to retrieve updated entity.', 500);
      return updatedEntity;
    } catch (error: unknown) {
      console.error('Error updating entity:', error);
      throw new AppError('Failed to update entity.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async deleteEntity(entityId: string, userId: string): Promise<boolean> {
    const existingEntity = await this.getEntityById(entityId, userId);
    if (!existingEntity) throw new NotFoundError('Entity not found or access denied.');

    const childrenResult = await this.db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM entities WHERE parent_id = ?1 AND user_id = ?2`, [entityId, userId]
    );
    if (childrenResult && childrenResult.count > 0) {
      throw new ValidationError('Cannot delete entity with children. Reassign children first.');
    }
    try {
      // FIXED: Changed executeD to execute
      const result: DbExecuteResult = await this.db.execute(
        `DELETE FROM entities WHERE id = ?1 AND user_id = ?2`, 
        [entityId, userId]
      );
      return result.success && (result.meta?.changes ?? 0) > 0;
    } catch (error: unknown) {
      console.error('Error deleting entity:', error);
      throw new AppError('Failed to delete entity.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }
}

export function createEntityService(d1: D1Database): EntityService {
  return new EntityService(d1);
}