-- Migration: Add SHOPPING_SESSION activity type and metadata column
-- Ticket: REMY-288

-- SQLite migration
-- Add metadata column to activities table
ALTER TABLE activities ADD COLUMN metadata TEXT;

-- Note: SQLite doesn't support ALTER TABLE for CHECK constraints
-- The new CHECK constraints with 'SHOPPING_SESSION' are added in initializeSchema
-- and will apply to new tables. Existing rows will work as the values
-- are still valid strings.
