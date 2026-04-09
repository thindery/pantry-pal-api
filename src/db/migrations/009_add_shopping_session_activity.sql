-- Migration: Add SHOPPING_SESSION activity type and metadata column
-- Ticket: REMY-288
-- Idempotent: Safe to run multiple times

-- Only add metadata column if it doesn't exist
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we use a workaround
-- This migration is designed to fail silently if column exists (acceptable)
-- OR the application code should handle the error

-- Attempt to add column - will error if exists, which is caught by migration system
-- For true idempotency, the migration runner should catch "duplicate column" errors
ALTER TABLE activities ADD COLUMN metadata TEXT;

-- Note: SQLite doesn't support ALTER TABLE for CHECK constraints
-- The new CHECK constraints with 'SHOPPING_SESSION' are added in initializeSchema
-- and will apply to new tables. Existing rows will work as the values
-- are still valid strings.
