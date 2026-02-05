-- Migration: Add subscription fields to support monetization
-- Created: 2025-02-04

-- Add subscription fields to pantry_items table (for tracking per-user)
-- Note: We already have user_id from previous migration

-- Create user_subscriptions table to track subscription status
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'family')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  subscription_status TEXT DEFAULT 'incomplete' CHECK(subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
  subscription_start_date TEXT,
  subscription_end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create usage tracking table for feature limits
CREATE TABLE IF NOT EXISTS usage_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM format
  receipt_scans INTEGER DEFAULT 0,
  ai_calls INTEGER DEFAULT 0,
  voice_sessions INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON usage_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_limits_user_month ON usage_limits(user_id, month);

-- Insert default 'free' tier records for existing users (will be done via migration script)
