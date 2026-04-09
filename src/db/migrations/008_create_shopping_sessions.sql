-- Migration: Shopping Session Tables
-- Purpose: Support shopping session mode for barcode scanning and real-time total tracking
-- Created: 2025-04-08
-- Ticket: REMY-285

-- ============================================================================
-- Shopping Sessions Table
-- Tracks active and completed shopping sessions per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    store_name TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    total_amount DECIMAL(10, 2) DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    receipt_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user_subscriptions(user_id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user_id ON shopping_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_sessions_status ON shopping_sessions(status);
CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user_status ON shopping_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shopping_sessions_started_at ON shopping_sessions(started_at);

-- ============================================================================
-- Session Items Table
-- Items added to a shopping session (cart items before import to inventory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    unit TEXT,
    price DECIMAL(10, 2),
    category TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES shopping_sessions(id) ON DELETE CASCADE
);

-- Indexes for session item queries
CREATE INDEX IF NOT EXISTS idx_session_items_session_id ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_barcode ON session_items(barcode);

-- ============================================================================
-- Migration Metadata
-- ============================================================================

-- Track migration completion
INSERT OR IGNORE INTO migrations (version, applied_at, description) 
VALUES (8, datetime('now'), 'Create shopping_sessions and session_items tables');
