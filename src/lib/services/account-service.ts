// src/lib/services/account-service.ts
import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { createDbClient, type Database, type DbExecuteResult } from "@db/db";
import type {
  DbChartOfAccount,
  AccountSystemType as DbAccountSystemType,
} from "@db/schema";
// FIXED: Import the proper error classes
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../utils/errors";
import {
  defaultChartOfAccounts,
  type ChartOfAccountsItemDefinition,
} from "../accounting/core/chart-of-accounts.ts";

// Input type for creating/updating accounts
export interface AccountServiceInput {
  code: string;
  name: string;
  type: DbAccountSystemType;
  subtype?: string | null;
  description?: string | null;
  is_recoverable?: boolean; // App-level boolean
  recovery_percentage?: number | null; // App-level 0-100, needs conversion to/from basis points for DB
  tax_category?: string | null;
  is_active?: boolean; // App-level boolean
  parent_id?: string | null;
}

export class AccountService {
  private db: Database;
  private readonly TABLE_NAME = "chart_of_accounts";
  private readonly TX_TABLE_NAME = "transactions"; // For checking account usage

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
  }

  /**
   * Convert database representation to app representation
   */
  private mapDbToApp(dbAccount: DbChartOfAccount): DbChartOfAccount {
    return {
      ...dbAccount,
      is_recoverable: dbAccount.is_recoverable, // Stays number (0 or 1) if DbChartOfAccount is direct DB type
      is_active: dbAccount.is_active, // Stays number (0 or 1)
      // recovery_percentage is already number | null (basis points)
    };
  }

  /**
   * Convert app boolean to database 0/1 format
   */
  private boolToDb(
    value: boolean | undefined,
    defaultValue: boolean = false
  ): number {
    return value === undefined ? (defaultValue ? 1 : 0) : value ? 1 : 0;
  }

  /**
   * Convert app percentage (0-100) to basis points (0-10000)
   */
  private percentageToBasisPoints(
    value: number | null | undefined
  ): number | null {
    return typeof value === "number" ? Math.round(value * 100) : null;
  }

  async getAllAccounts(userId: string): Promise<DbChartOfAccount[]> {
    // Using numbered placeholders for parameters
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE user_id = ?1 ORDER BY code`;
    try {
      const results = await this.db.query<DbChartOfAccount>(sql, [userId]);
      return results.map(this.mapDbToApp);
    } catch (error: unknown) {
      console.error("AccountService.getAllAccounts error:", error);
      throw new AppError(
        "Failed to retrieve accounts.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async getAccountsByType(
    userId: string,
    type: DbAccountSystemType
  ): Promise<DbChartOfAccount[]> {
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE user_id = ?1 AND type = ?2 ORDER BY code`;
    try {
      const results = await this.db.query<DbChartOfAccount>(sql, [
        userId,
        type,
      ]);
      return results.map(this.mapDbToApp);
    } catch (error: unknown) {
      console.error("AccountService.getAccountsByType error:", error);
      throw new AppError(
        "Failed to retrieve accounts by type.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async getAccountById(
    id: string,
    userId: string
  ): Promise<DbChartOfAccount | null> {
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE id = ?1 AND user_id = ?2`;
    try {
      const account = await this.db.queryOne<DbChartOfAccount>(sql, [
        id,
        userId,
      ]);
      return account ? this.mapDbToApp(account) : null;
    } catch (error: unknown) {
      console.error("AccountService.getAccountById error:", error);
      throw new AppError(
        "Failed to retrieve account by ID.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async getAccountByCode(
    code: string,
    userId: string
  ): Promise<DbChartOfAccount | null> {
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE code = ?1 AND user_id = ?2`;
    try {
      const account = await this.db.queryOne<DbChartOfAccount>(sql, [
        code,
        userId,
      ]);
      return account ? this.mapDbToApp(account) : null;
    } catch (error: unknown) {
      console.error("AccountService.getAccountByCode error:", error);
      throw new AppError(
        "Failed to retrieve account by code.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  /**
   * Check if an account is used in any transactions
   */
  async isAccountUsedInTransactions(
    accountId: string,
    userId: string
  ): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.TX_TABLE_NAME} 
      WHERE (debit_account_id = ?1 OR credit_account_id = ?1) 
      AND user_id = ?2
      LIMIT 1`;

    try {
      const result = await this.db.queryOne<{ 1: number }>(sql, [
        accountId,
        userId,
      ]);
      return !!result;
    } catch (error: unknown) {
      console.error("AccountService.isAccountUsedInTransactions error:", error);
      throw new AppError(
        "Failed to check account usage.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  /**
   * Check for circular parent-child dependencies
   */
  async checkCircularDependency(
    accountId: string,
    parentId: string,
    userId: string
  ): Promise<boolean> {
    // If this account is set as a parent to itself, it's circular
    if (accountId === parentId) return true;

    // Build ancestor chain to detect cycles
    const visited = new Set<string>([accountId]);
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      // If we've seen this ID before, we have a cycle
      if (visited.has(currentParentId)) return true;

      visited.add(currentParentId);

      // Get this parent's parent
      const parentAccount = await this.getAccountById(currentParentId, userId);
      if (!parentAccount) break;

      currentParentId = parentAccount.parent_id;
    }

    return false;
  }

  async createAccount(
    accountData: AccountServiceInput,
    userId: string
  ): Promise<DbChartOfAccount> {
    const existingAccountByCode = await this.getAccountByCode(
      accountData.code,
      userId
    );
    if (existingAccountByCode) {
      throw new ConflictError(
        `Account with code ${accountData.code} already exists.`
      );
    }

    if (accountData.parent_id) {
      const parentAccount = await this.getAccountById(
        accountData.parent_id,
        userId
      );
      if (!parentAccount) {
        throw new ValidationError("Parent account not found or access denied.");
      }

      // No need to check circular dependency for new accounts (they can't be parents yet)
    }

    const accountId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000); // Unix seconds

    // Convert app-level booleans/percentages to DB format using helper methods
    const dbIsRecoverable = this.boolToDb(accountData.is_recoverable, false);
    const dbIsActive = this.boolToDb(accountData.is_active, true); // Default true
    const dbRecoveryPercentage = this.percentageToBasisPoints(
      accountData.recovery_percentage
    );

    const sql = `
      INSERT INTO ${this.TABLE_NAME} (id, user_id, code, name, type, subtype, description, is_recoverable, recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`;
    const params = [
      accountId,
      userId,
      accountData.code,
      accountData.name,
      accountData.type,
      accountData.subtype || null,
      accountData.description || null,
      dbIsRecoverable,
      dbRecoveryPercentage,
      accountData.tax_category || null,
      dbIsActive,
      accountData.parent_id || null,
      now,
      now,
    ];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success || (result.meta?.changes ?? 0) === 0) {
        throw new AppError(
          result.error || "Failed to create account.",
          500,
          true,
          "DatabaseError",
          "DATABASE_ERROR"
        );
      }
      const newAccount = await this.getAccountById(accountId, userId);
      if (!newAccount) {
        throw new AppError(
          "Account created but not retrieved.",
          500,
          true,
          "DatabaseError",
          "DATABASE_ERROR"
        );
      }
      return newAccount; // mapDbToApp is already called by getAccountById
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error("AccountService.createAccount error:", error);
      throw new AppError(
        "Unexpected error creating account.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async updateAccount(
    accountId: string,
    accountData: Partial<AccountServiceInput>,
    userId: string
  ): Promise<DbChartOfAccount> {
    const existingAccount = await this.getAccountById(accountId, userId);
    if (!existingAccount)
      throw new NotFoundError("Account not found or access denied.");

    if (accountData.code && accountData.code !== existingAccount.code) {
      const conflictingAccount = await this.getAccountByCode(
        accountData.code,
        userId
      );
      if (conflictingAccount && conflictingAccount.id !== accountId) {
        throw new ConflictError(
          `Account code "${accountData.code}" is already in use.`
        );
      }
    }

    if (accountData.parent_id !== undefined) {
      // Check if parent_id is part of the update
      if (accountData.parent_id === accountId) {
        throw new ValidationError("Account cannot be its own parent.");
      }

      if (accountData.parent_id !== null) {
        // Only validate if it's not being set to null
        const parentAccount = await this.getAccountById(
          accountData.parent_id,
          userId
        );
        if (!parentAccount) {
          throw new ValidationError(
            "Parent account not found or access denied."
          );
        }

        // Check circular dependency
        const hasCircular = await this.checkCircularDependency(
          accountId,
          accountData.parent_id,
          userId
        );
        if (hasCircular) {
          throw new ValidationError(
            "Cannot set parent account: would create a circular dependency"
          );
        }
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Compare against existingAccount (which uses DB format, e.g., numbers for booleans)
    const addUpdateField = (
      key: keyof AccountServiceInput,
      dbKey: keyof DbChartOfAccount,
      transformToDbFormat?: (val: any) => any
    ) => {
      if (key in accountData && accountData[key] !== undefined) {
        const appValue = accountData[key];
        const dbValue = transformToDbFormat
          ? transformToDbFormat(appValue)
          : appValue;
        // Check if new value is different from existing DB value
        if (
          dbValue !== existingAccount[dbKey] ||
          (dbValue === null && existingAccount[dbKey] !== null)
        ) {
          updateFields.push(
            `${dbKey.toString()} = ?${updateValues.length + 1}`
          );
          updateValues.push(dbValue === undefined ? null : dbValue);
        }
      }
    };

    addUpdateField("code", "code");
    addUpdateField("name", "name");
    addUpdateField("type", "type");
    addUpdateField("subtype", "subtype");
    addUpdateField("description", "description");
    addUpdateField("is_recoverable", "is_recoverable", (v) => (v ? 1 : 0));
    addUpdateField("recovery_percentage", "recovery_percentage", (v) =>
      this.percentageToBasisPoints(v)
    );
    addUpdateField("tax_category", "tax_category");
    addUpdateField("is_active", "is_active", (v) => (v ? 1 : 0));
    addUpdateField("parent_id", "parent_id");

    if (updateFields.length === 0) return existingAccount;

    // Add updated_at
    updateFields.push(`updated_at = ?${updateValues.length + 1}`);
    updateValues.push(now);

    // Add id and user_id parameters
    updateValues.push(accountId, userId);
    const sql = `UPDATE ${this.TABLE_NAME} SET ${updateFields.join(", ")} WHERE id = ?${updateValues.length - 1} AND user_id = ?${updateValues.length}`;

    try {
      const result: DbExecuteResult = await this.db.execute(sql, updateValues);
      if (!result.success) {
        /* Optional: Check result.meta.changes, could be 0 if data is same */
      }
      const updatedAccount = await this.getAccountById(accountId, userId);
      if (!updatedAccount) {
        throw new AppError(
          "Account updated but not retrievable.",
          500,
          true,
          "DatabaseError",
          "DATABASE_ERROR"
        );
      }
      return updatedAccount;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error("AccountService.updateAccount error:", error);
      throw new AppError(
        "Unexpected error updating account.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async deleteAccount(accountId: string, userId: string): Promise<boolean> {
    const account = await this.getAccountById(accountId, userId);
    if (!account)
      throw new NotFoundError("Account not found or access denied.");

    // Check for child accounts
    const childAccountsSql = `SELECT id FROM ${this.TABLE_NAME} WHERE parent_id = ?1 AND user_id = ?2 LIMIT 1`;
    const childAccount = await this.db.queryOne<{ id: string }>(
      childAccountsSql,
      [accountId, userId]
    );
    if (childAccount) {
      throw new ValidationError(
        "Cannot delete account that is a parent. Reassign children first."
      );
    }

    // Check if account is used in transactions
    const isUsedInTransactions = await this.isAccountUsedInTransactions(
      accountId,
      userId
    );
    if (isUsedInTransactions) {
      throw new ValidationError(
        "Cannot delete account that is used in transactions."
      );
    }

    // Check if account is used in entity_accounts (through a JOIN)
    const entityAccountsSql = `
      SELECT ea.id FROM entity_accounts ea
      WHERE ea.account_id = ?1 AND ea.user_id = ?2
      LIMIT 1
    `;
    const entityAccount = await this.db.queryOne<{ id: string }>(
      entityAccountsSql,
      [accountId, userId]
    );
    if (entityAccount) {
      throw new ValidationError(
        "Cannot delete account that is linked to entities. Remove entity associations first."
      );
    }

    const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id = ?1 AND user_id = ?2`;
    try {
      const result: DbExecuteResult = await this.db.execute(sql, [
        accountId,
        userId,
      ]);
      return result.success && (result.meta?.changes ?? 0) > 0;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error("AccountService.deleteAccount error:", error);
      throw new AppError(
        "Unexpected error deleting account.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  /**
   * Update multiple accounts in a batch operation
   */
  async batchUpdateAccounts(
    accountUpdates: Array<{ id: string; data: Partial<AccountServiceInput> }>,
    userId: string
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const statements: D1PreparedStatement[] = [];

    for (const update of accountUpdates) {
      const existingAccount = await this.getAccountById(update.id, userId);
      if (!existingAccount) continue; // Skip non-existent accounts

      // Validate parent_id if present
      if (
        update.data.parent_id !== undefined &&
        update.data.parent_id !== null
      ) {
        // Skip self-references
        if (update.data.parent_id === update.id) continue;

        // Validate parent exists
        const parentAccount = await this.getAccountById(
          update.data.parent_id,
          userId
        );
        if (!parentAccount) continue;

        // Check circular dependency
        const hasCircular = await this.checkCircularDependency(
          update.id,
          update.data.parent_id,
          userId
        );
        if (hasCircular) continue;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Helper to add fields to update
      const addField = (
        key: keyof AccountServiceInput,
        dbKey: string,
        transform?: (v: any) => any
      ) => {
        if (key in update.data && update.data[key] !== undefined) {
          const value = update.data[key];
          updateFields.push(`${dbKey} = ?${paramIndex}`);
          paramIndex++;
          updateValues.push(
            transform ? transform(value) : value === undefined ? null : value
          );
        }
      };

      // Add all possible fields to update
      addField("code", "code");
      addField("name", "name");
      addField("type", "type");
      addField("subtype", "subtype");
      addField("description", "description");
      addField("is_recoverable", "is_recoverable", (v) =>
        this.boolToDb(v, false)
      );
      addField("recovery_percentage", "recovery_percentage", (v) =>
        this.percentageToBasisPoints(v)
      );
      addField("tax_category", "tax_category");
      addField("is_active", "is_active", (v) => this.boolToDb(v, true));
      addField("parent_id", "parent_id");

      if (updateFields.length === 0) continue;

      // Add updated_at timestamp
      updateFields.push(`updated_at = ?${paramIndex}`);
      paramIndex++;
      updateValues.push(now);

      // Add WHERE clause parameters
      const sql = `UPDATE ${this.TABLE_NAME} SET ${updateFields.join(", ")} WHERE id = ?${paramIndex} AND user_id = ?${paramIndex + 1}`;

      // For D1 direct binding, we need to spread all parameters
      const allBindParams = [...updateValues, update.id, userId];
      const boundStmt = this.db.d1Instance.prepare(sql).bind(...allBindParams);

      statements.push(boundStmt);
    }

    if (statements.length === 0) return 0;

    try {
      const results = await this.db.batch(statements);
      let updatedCount = 0;

      results.forEach((result) => {
        if (result.success && result.meta?.changes) {
          updatedCount += result.meta.changes;
        }
      });

      return updatedCount;
    } catch (error: unknown) {
      console.error("AccountService.batchUpdateAccounts error:", error);
      throw new AppError(
        "Failed to perform batch account updates.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async initializeDefaultAccounts(userId: string): Promise<number> {
    const existingUserCoa = await this.getAllAccounts(userId);
    if (
      defaultChartOfAccounts.some((defAcc) =>
        existingUserCoa.find(
          (exAcc) => exAcc.code === defAcc.code && exAcc.user_id === userId
        )
      )
    ) {
      console.log(
        `Default accounts likely exist for user ${userId}. Skipping full initialization.`
      );
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    let insertedCount = 0;
    const codeToIdMap = new Map<string, string>();
    const accountsToBatch: D1PreparedStatement[] = [];

    const preparedDefaults: Array<
      ChartOfAccountsItemDefinition & {
        generatedId: string;
        dbParentId: string | null;
      }
    > = [];

    // First pass to generate IDs and prepare data, without resolving parent_id yet
    for (const defAcct of defaultChartOfAccounts) {
      const accountId = crypto.randomUUID();
      codeToIdMap.set(defAcct.code, accountId);
      preparedDefaults.push({
        ...defAcct,
        generatedId: accountId,
        dbParentId: null,
      });
    }

    // Second pass to resolve parent_id using the generated IDs
    for (const accToInsert of preparedDefaults) {
      if (accToInsert.parentCode) {
        accToInsert.dbParentId =
          codeToIdMap.get(accToInsert.parentCode) || null;
      }

      const dbIsRecoverable = accToInsert.isRecoverable ? 1 : 0;
      // Defaults in ChartOfAccountsItemDefinition do not have recovery_percentage
      // DbChartOfAccount.recovery_percentage is basis points.
      const dbRecoveryPercentage = accToInsert.isRecoverable ? 10000 : null; // Default 100% if recoverable

      // Using ?1, ?2, etc. for parameters
      const sql = `
          INSERT INTO ${this.TABLE_NAME} (id, user_id, code, name, type, subtype, description, is_recoverable, recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`;
      accountsToBatch.push(
        this.db.d1Instance.prepare(sql).bind(
          accToInsert.generatedId,
          userId,
          accToInsert.code,
          accToInsert.name,
          accToInsert.type,
          accToInsert.subtype || null,
          accToInsert.description || null,
          dbIsRecoverable,
          dbRecoveryPercentage,
          null, // tax_category from defaultChartOfAccounts not used, default to null
          1, // is_active default true
          accToInsert.dbParentId, // Use resolved parent_id
          now,
          now
        )
      );
    }

    if (accountsToBatch.length === 0) return 0;
    try {
      const results = await this.db.batch(accountsToBatch);
      results.forEach((result) => {
        if (result.success && result.meta?.changes)
          insertedCount += result.meta.changes;
        else if (!result.success)
          console.warn("Failed to insert a default account:", result.error);
      });
      return insertedCount;
    } catch (error: unknown) {
      console.error(
        "AccountService.initializeDefaultAccounts batch error:",
        error
      );
      throw new AppError(
        "Failed to initialize default accounts.",
        500,
        true,
        "DatabaseError",
        "DATABASE_ERROR"
      );
    }
  }

  async getAccountHierarchy(userId: string): Promise<
    Array<
      DbChartOfAccount & {
        children: Array<DbChartOfAccount & { children: any[] }>;
      }
    >
  > {
    const allAccountsFlat = await this.getAllAccounts(userId);
    if (!allAccountsFlat || allAccountsFlat.length === 0) return [];

    type HierarchicalAccount = DbChartOfAccount & {
      children: HierarchicalAccount[];
    };
    const accountsById = new Map<string, HierarchicalAccount>();
    allAccountsFlat.forEach((acc) =>
      accountsById.set(acc.id, { ...this.mapDbToApp(acc), children: [] })
    );

    const rootAccounts: HierarchicalAccount[] = [];
    for (const account of accountsById.values()) {
      if (account.parent_id && accountsById.has(account.parent_id)) {
        accountsById.get(account.parent_id)!.children.push(account);
      } else {
        rootAccounts.push(account);
      }
    }
    const sortChildrenByCode = (accounts: HierarchicalAccount[]) => {
      accounts.sort((a, b) => a.code.localeCompare(b.code));
      accounts.forEach((acc) => sortChildrenByCode(acc.children));
    };
    sortChildrenByCode(rootAccounts);
    return rootAccounts;
  }
}

export function createAccountService(d1: D1Database): AccountService {
  return new AccountService(d1);
}
