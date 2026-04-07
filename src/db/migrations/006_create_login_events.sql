-- Migration: Create login events table for DAU tracking
-- Created: 2026-02-13

CREATE TABLE IF NOT EXISTS login_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON login_events(created_at);
CREATE INDEX IF NOT EXISTS idx_login_events_user_date ON login_events(user_id, date(created_at));
