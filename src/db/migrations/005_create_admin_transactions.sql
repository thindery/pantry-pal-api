-- Migration: Create admin transactions table for revenue tracking
-- Created: 2026-02-13

CREATE TABLE IF NOT EXISTS admin_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK(status IN ('succeeded', 'failed', 'pending', 'refunded')),
  tier TEXT CHECK(tier IN ('free', 'pro', 'family')),
  billing_interval TEXT CHECK(billing_interval IN ('month', 'year')),
  failure_code TEXT,
  failure_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  stripe_event_id TEXT
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_transactions_user_id ON admin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_status ON admin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_created_at ON admin_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_stripe_event_id ON admin_transactions(stripe_event_id);
