-- Migration: cloudflare/d1/migrations/0002_accounting.sql
-- Description: Sets up tables for Chart of Accounts, Journals, Transactions, and Transaction Lines.

PRAGMA foreign_keys = ON;

-- Chart of Accounts (CoA) - Defines the accounts available to an entity or user.
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY, -- UUID for the account definition
    user_id TEXT NOT NULL, -- User who owns this account definition (can be shared or per-entity context)
    -- entity_id TEXT, -- Optional: If COA is strictly per-entity, uncomment and add FK to entities.
    code TEXT NOT NULL, -- Account number (e.g., "1010", "6050")
    name TEXT NOT NULL, -- Account name (e.g., "Cash", "Rent Expense")
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')), -- Fundamental account type
    subtype TEXT, -- More specific classification (e.g., 'current_asset', 'operating_expense')
    description TEXT,
    is_recoverable INTEGER NOT NULL DEFAULT 0, -- For expense accounts, 0 or 1
    recovery_percentage INTEGER, -- Basis points (e.g., 75% = 7500), if is_recoverable is 1
    is_active INTEGER NOT NULL DEFAULT 1, -- Can transactions be posted to this account?
    tax_category TEXT, -- Link to tax form lines or categories
    parent_id TEXT, -- For hierarchical CoA
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    -- UNIQUE (user_id, code), -- Account codes should be unique per user/entity context
    -- UNIQUE (entity_id, code), -- If using entity_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    -- FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_coa_user_id_code ON chart_of_accounts(user_id, code);
-- CREATE INDEX IF NOT EXISTS idx_coa_entity_id_code ON chart_of_accounts(entity_id, code);
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS idx_coa_parent_id ON chart_of_accounts(parent_id);

-- Entity-specific Accounts (links CoA definitions to a specific entity, allowing overrides or balances)
-- This table might be used if you want a global CoA template that entities can instantiate.
-- Or, if CoA is directly tied to entity_id above, this table might not be needed,
-- and balances would be stored elsewhere (e.g., in a ledger table).
CREATE TABLE IF NOT EXISTS entity_accounts (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL, -- User context (owner of the entity)
    entity_id TEXT NOT NULL,
    account_id TEXT NOT NULL, -- FK to chart_of_accounts.id
    custom_name TEXT, -- Entity-specific override for the account name
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Potentially store entity-specific settings like recovery_type, recovery_percentage if they override CoA
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (entity_id, account_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT -- Prevent deleting CoA if used
);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_entity_id ON entity_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_account_id ON entity_accounts(account_id);


-- Journals (Optional, for grouping related transactions, e.g., Sales Journal, Purchase Journal)
CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL, -- e.g., "General Journal", "Sales Journal"
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_journals_entity_id ON journals(entity_id);

-- Transactions (Header for a financial event)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL, -- User who owns/created this transaction
    entity_id TEXT NOT NULL,
    journal_id TEXT, -- Optional link to a journal
    date INTEGER NOT NULL, -- Date of the transaction (Unix timestamp seconds)
    description TEXT NOT NULL,
    reference TEXT, -- e.g., Check number, Invoice ID
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'voided')),
    is_reconciled INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
    document_url TEXT, -- Link to supporting document (e.g., R2 path)
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_id_date ON transactions(entity_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Transaction Lines (Details of a transaction - debits and credits)
-- Each transaction must have at least two lines, and debits must equal credits.
CREATE TABLE IF NOT EXISTS transaction_lines (
    id TEXT PRIMARY KEY, -- UUID
    transaction_id TEXT NOT NULL,
    -- Use entity_account_id if balances/CoA are specific to an entity instance of a CoA definition
    -- Use chart_of_account_id if CoA is global or directly tied to entity via chart_of_accounts.entity_id
    entity_account_id TEXT NOT NULL, -- FK to entity_accounts.id (or chart_of_accounts.id if simpler model)
    amount INTEGER NOT NULL, -- Amount in cents, always positive
    is_debit INTEGER NOT NULL, -- 1 for debit, 0 for credit
    memo TEXT, -- Line-specific description
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    -- tax_code TEXT, -- Optional for tax reporting
    -- metadata TEXT, -- JSON for custom line properties
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (entity_account_id) REFERENCES entity_accounts(id) ON DELETE RESTRICT -- Or chart_of_accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id ON transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_entity_account_id ON transaction_lines(entity_account_id);

-- Note on Balances:
-- Account balances are typically not stored directly in the CoA or EntityAccounts table.
-- They are derived by summing transaction_lines for each account, or by maintaining a separate ledger table
-- that is updated when transactions are posted. For simplicity here, balances are calculated.
