-- Migration: Add Product Cache table for Open Food Facts API
-- Ticket: REMY-295
-- Purpose: Cache product lookups to avoid rate limiting

CREATE TABLE IF NOT EXISTS product_cache (
    barcode TEXT PRIMARY KEY,
    product_name TEXT,
    brand TEXT,
    category TEXT,
    image_url TEXT,
    ingredients TEXT,
    nutrition_data TEXT, -- JSON string
    fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cache_ttl INTEGER DEFAULT 2592000, -- 30 days in seconds
    needs_sync INTEGER DEFAULT 0, -- 1 if needs background refresh
    sync_retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Index for sync queue lookups
CREATE INDEX IF NOT EXISTS idx_product_cache_needs_sync ON product_cache(needs_sync) WHERE needs_sync = 1;

-- Index for fetched_at to check cache expiry
CREATE INDEX IF NOT EXISTS idx_product_cache_fetched_at ON product_cache(fetched_at);
