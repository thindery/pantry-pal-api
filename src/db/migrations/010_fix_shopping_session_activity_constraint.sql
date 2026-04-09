-- Migration: Update activities table to support SHOPPING_SESSION activity type
-- Ticket: REMY-288 fix

-- SQLite doesn't support ALTER TABLE for CHECK constraints
-- Need to recreate the table with updated constraint

-- Step 1: Create new table with updated constraint
CREATE TABLE activities_new (
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

-- Step 2: Copy data from old table
INSERT INTO activities_new 
    SELECT * FROM activities;

-- Step 3: Drop old table
DROP TABLE activities;

-- Step 4: Rename new table
ALTER TABLE activities_new RENAME TO activities;

-- Step 5: Recreate indexes
CREATE INDEX idx_activities_item_id ON activities(item_id);
CREATE INDEX idx_activities_timestamp ON activities(timestamp DESC);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_user_id ON activities(user_id);
