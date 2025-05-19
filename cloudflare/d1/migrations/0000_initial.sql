-- Migration: cloudflare/d1/migrations/0000_initial.sql
-- Initial schema for ProperAccount Phase 1
-- Description: Sets up users table, sessions, and authentication-related tables

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'user', 'admin'
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    verified_at INTEGER, -- When email was verified, null if unverified
    image_url TEXT
);

-- Create index on email for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions Table (for custom session management)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    data TEXT, -- JSON string of session data
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AuthAccounts Table (for OAuth providers)
CREATE TABLE IF NOT EXISTS auth_accounts (
    provider_id TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (provider_id, provider_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- VerificationTokens Table (for email verification, password reset)
CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (identifier, token)
);

-- ActivityLogs Table (for security auditing)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL, -- 'login', 'logout', 'password_reset', etc.
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON string with additional details
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index on user_id and action for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs(user_id, action);

-- Create index on created_at for activity logs (for cleanup/retention policies)
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);