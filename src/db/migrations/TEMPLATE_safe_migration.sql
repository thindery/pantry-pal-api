-- Template: XXX_descriptive_name.sql
-- Purpose: [describe what this migration does]
-- Safe/Unsafe: [Safe - adding only / ⚠️ Multi-step required]

-- ============================================
-- SAFE OPERATIONS (always safe)
-- ============================================

-- Add new table
-- CREATE TABLE IF NOT EXISTS new_table (
--   id TEXT PRIMARY KEY,
--   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- Add new column with default
-- ALTER TABLE existing_table 
-- ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT 'default_value';

-- Add non-unique index
-- CREATE INDEX CONCURRENTLY idx_name ON table(column); -- PostgreSQL
-- CREATE INDEX IF NOT EXISTS idx_name ON table(column); -- SQLite

-- ============================================
-- ⚠️ DANGEROUS OPERATIONS (require multi-step)
-- ============================================
-- 
-- REMOVING columns:
--   Step 1: Deploy code that stops using column
--   Step 2: Wait 24+ hours
--   Step 3: THEN run: ALTER TABLE ... DROP COLUMN ...
--
-- RENAMING columns:
--   Step 1: Add new column: ALTER TABLE ... ADD COLUMN new_name TYPE
--   Step 2: Deploy code that writes to BOTH columns
--   Step 3: Backfill data: UPDATE table SET new_name = old_name
--   Step 4: Deploy code that only uses new_name
--   Step 5: Drop old column: ALTER TABLE ... DROP COLUMN old_name
--
-- CHANGING column types:
--   Step 1: Add new column with new type
--   Step 2: Migrate data
--   Step 3: Update code
--   Step 4: Drop old column

-- ============================================
-- POST-MIGRATION VERIFICATION (add for production)
-- ============================================
-- Uncomment these for production to verify:

-- -- Verify table/column exists
-- \echo 'Verifying migration...'
-- \dt new_table  -- PostgreSQL
-- .tables      -- SQLite
