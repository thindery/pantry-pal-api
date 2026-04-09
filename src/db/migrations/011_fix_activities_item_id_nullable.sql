-- Migration: Fix activities table foreign key for SHOPPING_SESSION type
-- Ticket: REMY-002
-- Makes item_id nullable with CHECK constraints per API Architect recommendation

-- Step 1: Create new table with nullable item_id and CHECK constraints
CREATE TABLE IF NOT EXISTS activities_new (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES pantry_items(id) ON DELETE CASCADE,  -- Now nullable
    item_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('ADD', 'REMOVE', 'ADJUST', 'SHOPPING_SESSION')),
    amount REAL NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE', 'SHOPPING_SESSION')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    metadata TEXT,
    -- CHECK constraint: ADD/REMOVE/ADJUST require item_id, SHOPPING_SESSION allows NULL
    CONSTRAINT chk_item_required_for_types CHECK (
        (type IN ('ADD', 'REMOVE', 'ADJUST') AND item_id IS NOT NULL) OR
        (type = 'SHOPPING_SESSION')
    )
);

-- Step 2: Copy data from old table
INSERT INTO activities_new 
    SELECT * FROM activities;

-- Step 3: Drop old table
DROP TABLE IF EXISTS activities;

-- Step 4: Rename new table
ALTER TABLE activities_new RENAME TO activities;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
