// cloudflare/d1/schema.ts
import { sqliteTable, text, integer, primaryKey, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// ============================================
// AUTHENTICATION & USER TABLES
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
  verifiedAt: integer('verified_at'),
  imageUrl: text('image_url'),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
}));

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  expiresAt: integer('expires_at').notNull(),
  data: text('data'),
});

export const authAccounts = sqliteTable('auth_accounts', {
  providerId: text('provider_id').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
}));

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  type: text('type', { enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] }).notNull().default('EMAIL_VERIFICATION'),
}, (table) => ({
  pk: primaryKey({ columns: [table.identifier, table.token] }),
}));

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userActionIdx: index('idx_activity_logs_user_action').on(table.userId, table.action),
}));

// ============================================
// ENTITY MANAGEMENT TABLES
// ============================================

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  ein: text('ein'),
  address: text('address'),
  legalAddress: text('legal_address'),
  businessType: text('business_type'),
  parentId: text('parent_id').references((): any => entities.id, { onDelete: 'set null' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  allowsSubEntities: integer('allows_sub_entities', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdx: index('idx_entities_user_id').on(table.userId),
  einIdx: index('idx_entities_ein').on(table.ein),
}));

// ====== NEW ENTITY ACCESS TABLE ======
export const entityAccess = sqliteTable("entity_access", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entityId: text("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  permissions: text("permissions").notNull(), // JSON array of permissions
  grantedAt: integer("granted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  grantedByUserId: text("granted_by_user_id").notNull().references(() => users.id),
}, (table) => {
  return {
    entityUserIdx: index("entity_access_entity_user_idx").on(table.entityId, table.userId),
    userIdx: index("entity_access_user_idx").on(table.userId),
  };
});

// ============================================
// ACCOUNTING TABLES
// ============================================

export const chartOfAccounts = sqliteTable('chart_of_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['asset', 'liability', 'equity', 'income', 'expense'] }).notNull(),
  subtype: text('subtype'),
  description: text('description'),
  isRecoverable: integer('is_recoverable', { mode: 'boolean' }).notNull().default(false),
  recoveryPercentage: integer('recovery_percentage'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  taxCategory: text('tax_category'),
  parentId: text('parent_id').references((): any => chartOfAccounts.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userCodeUnique: unique('idx_coa_user_code').on(table.userId, table.code),
}));

export const entityAccounts = sqliteTable('entity_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  customName: text('custom_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  recoveryType: text('recovery_type'),
  recoveryPercentage: integer('recovery_percentage'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  entityAccountUnique: unique('idx_entity_accounts_entity_account').on(table.entityId, table.accountId),
}));

export const journals = sqliteTable('journals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  journalId: text('journal_id').references(() => journals.id, { onDelete: 'set null' }),
  date: integer('date').notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  status: text('status', { enum: ['pending', 'posted', 'voided'] }).notNull().default('pending'),
  isReconciled: integer('is_reconciled', { mode: 'boolean' }).notNull().default(false),
  documentUrl: text('document_url'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  entityDateIdx: index('idx_transactions_entity_id_date').on(table.entityId, table.date),
}));

export const transactionLines = sqliteTable('transaction_lines', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  entityAccountId: text('entity_account_id').notNull().references(() => entityAccounts.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(), // Amount in cents
  isDebit: integer('is_debit', { mode: 'boolean' }).notNull(),
  memo: text('memo'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (table) => ({
  transactionIdx: index('idx_transaction_lines_transaction_id').on(table.transactionId),
}));

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  authAccounts: many(authAccounts),
  activityLogs: many(activityLogs),
  entities: many(entities),
  chartOfAccounts: many(chartOfAccounts),
  journals: many(journals),
  transactions: many(transactions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, { fields: [authAccounts.userId], references: [users.id] }),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  user: one(users, { fields: [entities.userId], references: [users.id] }),
  parent: one(entities, { fields: [entities.parentId], references: [entities.id], relationName: 'parent_child' }),
  children: many(entities, { relationName: 'parent_child' }),
  entityAccounts: many(entityAccounts),
  journals: many(journals),
  transactions: many(transactions),
  entityAccess: many(entityAccess),
}));

export const entityAccessRelations = relations(entityAccess, ({ one }) => ({
  entity: one(entities, { fields: [entityAccess.entityId], references: [entities.id] }),
  user: one(users, { fields: [entityAccess.userId], references: [users.id] }),
  grantedBy: one(users, { fields: [entityAccess.grantedByUserId], references: [users.id] }),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  user: one(users, { fields: [chartOfAccounts.userId], references: [users.id] }),
  parent: one(chartOfAccounts, { fields: [chartOfAccounts.parentId], references: [chartOfAccounts.id], relationName: 'parent_child_coa' }),
  children: many(chartOfAccounts, { relationName: 'parent_child_coa' }),
  entityInstances: many(entityAccounts),
}));

export const entityAccountsRelations = relations(entityAccounts, ({ one, many }) => ({
  entity: one(entities, { fields: [entityAccounts.entityId], references: [entities.id] }),
  account: one(chartOfAccounts, { fields: [entityAccounts.accountId], references: [chartOfAccounts.id] }),
  transactionLines: many(transactionLines),
}));

export const journalsRelations = relations(journals, ({ one, many }) => ({
  user: one(users, { fields: [journals.userId], references: [users.id] }),
  entity: one(entities, { fields: [journals.entityId], references: [entities.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  entity: one(entities, { fields: [transactions.entityId], references: [entities.id] }),
  journal: one(journals, { fields: [transactions.journalId], references: [journals.id] }),
  lines: many(transactionLines),
}));

export const transactionLinesRelations = relations(transactionLines, ({ one }) => ({
  transaction: one(transactions, { fields: [transactionLines.transactionId], references: [transactions.id] }),
  entityAccount: one(entityAccounts, { fields: [transactionLines.entityAccountId], references: [entityAccounts.id] }),
}));
