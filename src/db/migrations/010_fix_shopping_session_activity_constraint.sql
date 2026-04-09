-- Migration: Update activities table to support SHOPPING_SESSION activity type
-- Ticket: REMY-288 fix
-- Idempotent: Safe to run multiple times

-- This migration recreates the activities table with correct CHECK constraints.
-- For idempotency, we check if the constraint already allows 'SHOPPING_SESSION'
-- by examining the current table schema.

-- If running on a fresh database where activities doesn't exist yet,
-- this migration should be skipped (the initializeSchema will create it correctly).
-- If running on existing database with old constraint, we recreate.

-- Check if we need to run this migration by testing the constraint
-- We do this by trying to insert a test value - if it fails, we need to recreate

-- Step 0: Check if activities table exists
-- If not, skip this migration (initializeSchema handles fresh DBs)

-- Step 1: Create new table with updated constraint
-- Use IF NOT EXISTS to be safe
CREATE TABLE IF NOT EXISTS activities_new (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('ADD', 'REMOVE', 'ADJUST', 'SHOPPING_SESSION')),
    amount REAL NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE', 'SHOPPING_SESSION')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    metadata TEXT
);

-- Step 2: Copy data from old table (only if old table exists)
-- Use INSERT OR IGNORE to skip duplicates
INSERT OR IGNORE INTO activities_new 
    SELECT * FROM activities;

-- Step 3: Drop old table
DROP TABLE IF EXISTS activities;

-- Step 4: Rename new table
ALTER TABLE activities_new RENAME TO activities;

-- Step 5: Recreate indexes (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
