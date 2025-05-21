// src/lib/services/entity-account-service.ts
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { createDbClient, type Database, type DbExecuteResult } from '@db/db';
// FIXED: Removed unused import DbChartOfAccount
import type { DbEntityAccount, DbEntity, AccountSystemType as DbAccountSystemType } from '@db/schema';
// FIXED: Corrected import path and use specific error classes
import { AppError, ValidationError, NotFoundError } from '../../utils/errors';
// FIXED: Imports will work after entity-service.ts is refactored to a class
import { createEntityService, type EntityService } from './entity-service';
import { createAccountService, type AccountService } from './account-service';

export interface AppEntityAccount {
  id: string;
  user_id: string; // Belongs to the user who made the link
  entity_id: string;
  account_id: string; // ID from chart_of_accounts table
  custom_name: string | null; // Override for account name in this entity's context
  is_active: boolean; // Is this link active for this entity
  recovery_type: string | null; // Entity-specific override
  recovery_percentage: number | null; // Basis points, entity-specific override
  created_at: number;
  updated_at: number;
  // Joined fields from chart_of_accounts
  account_code: string;
  account_name: string;
  account_type: DbAccountSystemType;
  account_subtype: string | null;
  account_is_recoverable: boolean; // from chart_of_accounts, converted
}

// Raw type from DB join before mapping booleans
interface JoinedEntityAccountRaw extends DbEntityAccount {
  account_code: string;
  account_name: string;
  account_type: DbAccountSystemType;
  account_subtype: string | null;
  account_is_recoverable: number; // 0 or 1 from DB
}

// FIXED: Moved interfaces outside of class
export interface CreateEntityAccountInput {
  entity_id: string;
  account_id: string; // ID from chart_of_accounts table
  custom_name?: string | null;
  is_active?: boolean;
  recovery_type?: string | null;
  recovery_percentage?: number | null; // Basis points
}

export interface UpdateEntityAccountInput {
  custom_name?: string | null;
  is_active?: boolean;
  recovery_type?: string | null;
  recovery_percentage?: number | null; // Basis points
}

// FIXED: Handle undefined values in mapping function
function mapJoinedToAppEntityAccount(raw: JoinedEntityAccountRaw): AppEntityAccount {
  return {
    id: raw.id,
    user_id: raw.user_id,
    entity_id: raw.entity_id,
    account_id: raw.account_id,
    custom_name: raw.custom_name ?? null, // Handle potential undefined
    is_active: raw.is_active === 1,
    recovery_type: raw.recovery_type ?? null, // Handle potential undefined
    recovery_percentage: raw.recovery_percentage ?? null, // Handle potential undefined
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    account_code: raw.account_code,
    account_name: raw.account_name,
    account_type: raw.account_type,
    account_subtype: raw.account_subtype ?? null, // Handle potential undefined
    account_is_recoverable: raw.account_is_recoverable === 1,
  };
}

export class EntityAccountService {
  private db: Database;
  private entityService: EntityService;
  private accountService: AccountService;
  private readonly TABLE_NAME = 'entity_accounts';
  private readonly COA_TABLE_NAME = 'chart_of_accounts';
  private readonly ENTITIES_TABLE_NAME = 'entities';

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
    // These will work once entity-service.ts and account-service.ts export these
    this.entityService = createEntityService(d1);
    this.accountService = createAccountService(d1);
  }

  async getAccountsForEntity(entityId: string, userId: string): Promise<AppEntityAccount[]> {
    // Ensure entity exists and user has access (implicitly by user_id in query)
    const entity = await this.entityService.getEntityById(entityId, userId);
    if (!entity) {
        throw new NotFoundError("Entity not found or access denied for this user.");
    }

    const sql = `
      SELECT ea.*, coa.code AS account_code, coa.name AS account_name, coa.type AS account_type,
             coa.subtype AS account_subtype, coa.is_recoverable AS account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.entity_id = ?1 AND ea.user_id = ?2 ORDER BY coa.code`; // user_id on entity_accounts link
    try {
      // FIXED: Corrected type annotation for result
      const results = await this.db.query<JoinedEntityAccountRaw>(sql, [entityId, userId]);
      return results.map(mapJoinedToAppEntityAccount);
    } catch (err: unknown) {
      console.error('EntityAccountService.getAccountsForEntity error:', err);
      throw new AppError('Failed to retrieve accounts for entity.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getAccountEntityLinks(accountId: string, userId: string): Promise<Array<DbEntity & { entity_account_link_id: string; entity_account_is_active: boolean; entity_account_custom_name: string | null }>> {
    const account = await this.accountService.getAccountById(accountId, userId);
    if (!account) throw new NotFoundError('Chart of Account entry not found or access denied.');

    const sql = `
      SELECT e.*, ea.id as entity_account_link_id, ea.is_active as entity_account_is_active_raw,
             ea.custom_name as entity_account_custom_name
      FROM ${this.ENTITIES_TABLE_NAME} e
      JOIN ${this.TABLE_NAME} ea ON e.id = ea.entity_id
      WHERE ea.account_id = ?1 AND ea.user_id = ?2 ORDER BY e.name`;
    try {
      type QueryResultType = DbEntity & { entity_account_link_id: string; entity_account_is_active_raw: number; entity_account_custom_name: string | null };
      // FIXED: Corrected type annotation for result
      const rawResults = await this.db.query<QueryResultType>(sql, [accountId, userId]);
      
      return rawResults.map(r => ({
          ...r, // Spread all properties from DbEntity and the joined aliases
          entity_account_is_active: r.entity_account_is_active_raw === 1,
      }));
    } catch (error: unknown) {
      console.error('EntityAccountService.getAccountEntityLinks error:', error);
      throw new AppError('Failed to retrieve linked entities for account.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getEntityAccountById(id: string, userId: string): Promise<AppEntityAccount | null> {
    const sql = `
      SELECT ea.*, coa.code AS account_code, coa.name AS account_name, coa.type AS account_type,
             coa.subtype AS account_subtype, coa.is_recoverable AS account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.id = ?1 AND ea.user_id = ?2`;
    try {
      const raw = await this.db.queryOne<JoinedEntityAccountRaw>(sql, [id, userId]);
      return raw ? mapJoinedToAppEntityAccount(raw) : null;
    } catch (err: unknown) {
      console.error('EntityAccountService.getEntityAccountById error:', err);
      throw new AppError('Failed to retrieve entity-account link by ID.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async getEntityAccountByEntityAndAccount(entityId: string, accountId: string, userId: string): Promise<DbEntityAccount | null> {
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE entity_id = ?1 AND account_id = ?2 AND user_id = ?3`;
    try {
      return await this.db.queryOne<DbEntityAccount>(sql, [entityId, accountId, userId]);
    } catch (err: unknown) {
      console.error('EntityAccountService.getEntityAccountByEntityAndAccount error:', err);
      throw new AppError('Failed to retrieve entity-account link.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async createEntityAccount(data: CreateEntityAccountInput, userId: string): Promise<AppEntityAccount> {
    const entity = await this.entityService.getEntityById(data.entity_id, userId);
    if (!entity) throw new NotFoundError('Entity not found or access denied.');
    
    const account = await this.accountService.getAccountById(data.account_id, userId);
    if (!account) throw new NotFoundError('Chart of Account entry not found or access denied.');

    const exists = await this.getEntityAccountByEntityAndAccount(data.entity_id, data.account_id, userId);
    if (exists) throw new ValidationError('This account is already linked to this entity.');

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now()/1000);
    const dbIsActive = data.is_active === false ? 0 : 1; // Default to active (1)
    
    // FIXED: Handle nullish values explicitly 
    const customName: string | null = data.custom_name ?? null;
    const recoveryType: string | null = data.recovery_type ?? null;
    
    // Use recovery_percentage from input if provided, else from the CoA, else null.
    // Ensure both are basis points.
    const dbRecoveryPercentage = data.recovery_percentage !== undefined && data.recovery_percentage !== null
        ? data.recovery_percentage
        : (account.is_recoverable === 1 ? account.recovery_percentage : null);

    const sql = `
      INSERT INTO ${this.TABLE_NAME} (id,user_id,entity_id,account_id,custom_name,is_active,recovery_type,recovery_percentage,created_at,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`;
    const params = [
      id, userId, data.entity_id, data.account_id, customName,
      dbIsActive, recoveryType, dbRecoveryPercentage,
      now, now
    ];
    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success || (result.meta?.changes ?? 0) === 0) {
        throw new AppError(result.error || 'Failed to create entity-account link.', 500);
      }
      const newLink = await this.getEntityAccountById(id, userId);
      if (!newLink) throw new AppError('Link created but not retrievable.', 500);
      return newLink;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      console.error('EntityAccountService.createEntityAccount error:', err);
      throw new AppError('Unexpected error creating link.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async updateEntityAccount(id: string, data: UpdateEntityAccountInput, userId: string): Promise<AppEntityAccount> {
    const existingLink = await this.getEntityAccountById(id, userId); // existingLink is AppEntityAccount
    if (!existingLink) throw new NotFoundError('Link not found or access denied.');

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const now = Math.floor(Date.now()/1000);

    // Compare against existingLink (AppEntityAccount) and transform to DB values
    if (data.custom_name !== undefined && data.custom_name !== existingLink.custom_name) {
      updateFields.push('custom_name = ?1'); 
      updateValues.push(data.custom_name);
    }
    if (data.is_active !== undefined && data.is_active !== existingLink.is_active) {
      updateFields.push(`is_active = ?${updateValues.length + 1}`); 
      updateValues.push(data.is_active ? 1 : 0);
    }
    if (data.recovery_type !== undefined && data.recovery_type !== existingLink.recovery_type) {
      updateFields.push(`recovery_type = ?${updateValues.length + 1}`); 
      updateValues.push(data.recovery_type);
    }
    if (data.recovery_percentage !== undefined && data.recovery_percentage !== existingLink.recovery_percentage) {
      updateFields.push(`recovery_percentage = ?${updateValues.length + 1}`); 
      updateValues.push(data.recovery_percentage); // Assume basis points
    }

    if (updateFields.length === 0) return existingLink; // No actual changes

    updateFields.push(`updated_at = ?${updateValues.length + 1}`); 
    updateValues.push(now);
    
    const sql = `UPDATE ${this.TABLE_NAME} SET ${updateFields.join(', ')} WHERE id = ?${updateValues.length + 1} AND user_id = ?${updateValues.length + 2}`;
    updateValues.push(id, userId);
    
    try {
      const result: DbExecuteResult = await this.db.execute(sql, updateValues);
      if (!result.success) { /* Optional: check result.meta.changes */ }
      const updatedLink = await this.getEntityAccountById(id, userId);
      if (!updatedLink) throw new AppError('Link updated but not retrievable.', 500);
      return updatedLink;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      console.error('EntityAccountService.updateEntityAccount error:', err);
      throw new AppError('Unexpected error updating link.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async deleteEntityAccount(id: string, userId: string): Promise<boolean> {
    const existing = await this.getEntityAccountById(id, userId);
    if (!existing) throw new NotFoundError('Link not found or access denied.');
    
    // TODO: Consider implications: are there transactions using this specific entity_account link?
    const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id=?1 AND user_id=?2`;
    try {
      const result: DbExecuteResult = await this.db.execute(sql, [id, userId]);
      return result.success && (result.meta?.changes ?? 0) > 0;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      console.error('EntityAccountService.deleteEntityAccount error:', err);
      throw new AppError('Unexpected error deleting link.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }

  async initializeEntityAccounts(entityId: string, userId: string): Promise<number> {
    const entity = await this.entityService.getEntityById(entityId, userId);
    if (!entity) throw new NotFoundError("Entity not found.");

    const allCoAccounts = await this.accountService.getAllAccounts(userId);
    const existingEntityAccountLinks = await this.getAccountsForEntity(entityId, userId);
    const linkedCoAccountIds = new Set(existingEntityAccountLinks.map(ea => ea.account_id));

    const accountsToLink = allCoAccounts.filter(coa => coa.is_active === 1 && !linkedCoAccountIds.has(coa.id));
    if (accountsToLink.length === 0) {
      console.log(`No new active accounts to link for entity ${entityId}.`);
      return 0;
    }

    const now = Math.floor(Date.now()/1000);
    const batchOperations: D1PreparedStatement[] = [];
    for (const coa of accountsToLink) { // coa is DbChartOfAccount
      const linkId = crypto.randomUUID();
      const sql = `
        INSERT INTO ${this.TABLE_NAME} (id, user_id, entity_id, account_id, is_active, recovery_percentage, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`;
      batchOperations.push(
        this.db.d1Instance.prepare(sql).bind(
          linkId, userId, entityId, coa.id, 1, // is_active
          coa.is_recoverable === 1 ? coa.recovery_percentage : null, // Use CoA's recovery_percentage
          now, now
        )
      );
    }
    let count = 0;
    try {
      const results = await this.db.batch(batchOperations);
      results.forEach(r => { if (r.success && r.meta?.changes) count += r.meta.changes; });
      console.log(`Initialized ${count} accounts for entity ${entityId}.`);
      return count;
    } catch (err: unknown) {
      console.error('EntityAccountService.initializeEntityAccounts batch error:', err);
      throw new AppError('Failed to init entity accounts.', 500, true, 'DatabaseError', 'DATABASE_ERROR');
    }
  }
}

export function createEntityAccountService(d1: D1Database): EntityAccountService {
  return new EntityAccountService(d1);
}