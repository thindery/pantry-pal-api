-- Migration: Add needs_sync columns to existing product_cache table
-- Ticket: REMY-295
-- Purpose: Add columns for background sync queue

-- Add needs_sync flag for background retry (ignore if exists)
ALTER TABLE product_cache ADD COLUMN needs_sync INTEGER DEFAULT 0;

-- Add sync_retry_count for tracking retry attempts (ignore if exists)
ALTER TABLE product_cache ADD COLUMN sync_retry_count INTEGER DEFAULT 0;

-- Add last_error for debugging failed lookups (ignore if exists)
ALTER TABLE product_cache ADD COLUMN last_error TEXT;

-- Index for sync queue lookups (safe to recreate)
CREATE INDEX IF NOT EXISTS idx_product_cache_needs_sync ON product_cache(needs_sync) WHERE needs_sync = 1;
