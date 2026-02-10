/**
 * Test Utilities
 * Helper functions for creating test databases and test data
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create an in-memory SQLite database for testing
 * Returns the database instance and cleanup function
 */
export function createTestDatabase(): { db: Database.Database; cleanup: () => void } {
  const db = new Database(':memory:');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Initialize schema
  initializeTestSchema(db);
  
  const cleanup = () => {
    db.close();
  };
  
  return { db, cleanup };
}

/**
 * Initialize the database schema for testing
 */
function initializeTestSchema(db: Database.Database): void {
  // Pantry items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pantry_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ADD', 'REMOVE', 'ADJUST')),
      amount REAL NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_name ON pantry_items(name);
    CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
  `);
}

/**
 * Create a test user ID
 */
export function createTestUserId(): string {
  return `test_user_${uuidv4()}`;
}

/**
 * Create a test item object
 */
export function createTestItem(userId: string, overrides?: Partial<{
  name: string;
  quantity: number;
  unit: string;
  category: string;
}>) {
  return {
    id: uuidv4(),
    userId,
    name: overrides?.name || 'Test Item',
    quantity: overrides?.quantity ?? 1,
    unit: overrides?.unit || 'pieces',
    category: overrides?.category || 'test',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Insert a test item into the database
 */
export function insertTestItem(
  db: Database.Database,
  userId: string,
  overrides?: Partial<{
    name: string;
    quantity: number;
    unit: string;
    category: string;
  }>
): any {
  const id = uuidv4();
  const now = new Date().toISOString();
  const name = overrides?.name || 'Test Item';
  const quantity = overrides?.quantity ?? 1;
  const unit = overrides?.unit || 'pieces';
  const category = overrides?.category || 'test';

  const stmt = db.prepare(`
    INSERT INTO pantry_items (id, user_id, name, quantity, unit, category, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, name, quantity, unit, category, now);

  return {
    id,
    userId,
    name,
    quantity,
    unit,
    category,
    lastUpdated: now,
  };
}

/**
 * Generate a valid test token for authentication
 */
export function getTestToken(userId?: string): string {
  return `test_token_${userId || createTestUserId()}`;
}
