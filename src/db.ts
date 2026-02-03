/**
 * Database layer using better-sqlite3
 * Handles connection, initialization, and core query operations
 * Designed for high-performance synchronous SQLite operations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  PantryItem,
  PantryItemRow,
  Activity,
  ActivityRow,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
} from './models/types';

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================================================
// Database Connection
// ============================================================================

let db: Database.Database | null = null;

/**
 * Get or create the database connection
 * Uses singleton pattern for connection reuse
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, {
      verbose: isDevelopment ? console.log : undefined,
    });

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    initializeSchema();
  }

  return db;
}

/**
 * Close database connection
 * Call this for graceful shutdown
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================================================
// Schema Initialization
// ============================================================================

/**
 * Create database tables if they don't exist
 * Includes indexes for common query patterns
 */
function initializeSchema(): void {
  if (!db) throw new Error('Database not initialized');

  // Pantry items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pantry_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Activities table with foreign key to pantry_items
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ADD', 'REMOVE', 'ADJUST')),
      amount REAL NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_name ON pantry_items(name);
    CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
  `);

  console.log('[DB] Schema initialized successfully');
}

// ============================================================================
// Row Mappers
// ============================================================================

function mapPantryItemRow(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    lastUpdated: row.last_updated,
  };
}

function mapActivityRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.type,
    amount: row.amount,
    timestamp: row.timestamp,
    source: row.source,
  };
}

// ============================================================================
// Pantry Item Operations
// ============================================================================

/**
 * Get all pantry items with optional filtering
 */
export function getAllItems(category?: string): PantryItem[] {
  const database = getDatabase();

  let query = 'SELECT * FROM pantry_items';
  const params: string[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY name COLLATE NOCASE';

  const stmt = database.prepare(query);
  const rows = stmt.all(...params) as PantryItemRow[];

  return rows.map(mapPantryItemRow);
}

/**
 * Get a single pantry item by ID
 */
export function getItemById(id: string): PantryItem | null {
  const database = getDatabase();

  const stmt = database.prepare('SELECT * FROM pantry_items WHERE id = ?');
  const row = stmt.get(id) as PantryItemRow | undefined;

  return row ? mapPantryItemRow(row) : null;
}

/**
 * Get a pantry item by name (case-insensitive)
 */
export function getItemByName(name: string): PantryItem | null {
  const database = getDatabase();

  const stmt = database.prepare(
    'SELECT * FROM pantry_items WHERE LOWER(name) = LOWER(?)'
  );
  const row = stmt.get(name) as PantryItemRow | undefined;

  return row ? mapPantryItemRow(row) : null;
}

/**
 * Input type for creating a new pantry item
 */
export interface CreateItemInput {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

/**
 * Input type for updating an existing pantry item
 */
export interface UpdateItemInput {
  name?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

/**
 * Create a new pantry item
 */
export function createItem(input: CreateItemInput): PantryItem {
  const database = getDatabase();

  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO pantry_items (id, name, quantity, unit, category, last_updated)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.name, input.quantity, input.unit, input.category, now);

  return {
    id,
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    category: input.category,
    lastUpdated: now,
  };
}

/**
 * Update an existing pantry item
 * Returns null if item not found
 */
export function updateItem(id: string, input: UpdateItemInput): PantryItem | null {
  // Type assertion ensures compatibility with both CreateItemInput from validation.ts and db.ts UpdateItemInput
  const database = getDatabase();

  const existing = getItemById(id);
  if (!existing) return null;

  const now = new Date().toISOString();

  // Build dynamic update query
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(input.quantity);
  }
  if (input.unit !== undefined) {
    updates.push('unit = ?');
    params.push(input.unit);
  }
  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category);
  }

  // Always update last_updated
  updates.push('last_updated = ?');
  params.push(now);

  // Add id to params
  params.push(id);

  const query = `UPDATE pantry_items SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = database.prepare(query);
  stmt.run(...params);

  return getItemById(id);
}

/**
 * Delete a pantry item by ID
 * Returns true if deleted, false if not found
 */
export function deleteItem(id: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare('DELETE FROM pantry_items WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Adjust item quantity directly (used by activity logging)
 */
export function adjustItemQuantity(
  id: string,
  adjustment: number
): PantryItem | null {
  const database = getDatabase();

  const existing = getItemById(id);
  if (!existing) return null;

  const newQuantity = Math.max(0, existing.quantity + adjustment);
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    UPDATE pantry_items 
    SET quantity = ?, last_updated = ? 
    WHERE id = ?
  `);

  stmt.run(newQuantity, now, id);

  return getItemById(id);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const database = getDatabase();

  const stmt = database.prepare(
    'SELECT DISTINCT category FROM pantry_items ORDER BY category COLLATE NOCASE'
  );
  const rows = stmt.all() as { category: string }[];

  return rows.map((r) => r.category);
}

// ============================================================================
// Activity Operations
// ============================================================================

/**
 * Get all activities with pagination
 */
export function getActivities(
  limit: number = 20,
  offset: number = 0,
  itemId?: string
): Activity[] {
  const database = getDatabase();

  let query = 'SELECT * FROM activities';
  const params: (string | number)[] = [];

  if (itemId) {
    query += ' WHERE item_id = ?';
    params.push(itemId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = database.prepare(query);
  const rows = stmt.all(...params) as ActivityRow[];

  return rows.map(mapActivityRow);
}

/**
 * Get total count of activities (for pagination)
 */
export function getActivityCount(itemId?: string): number {
  const database = getDatabase();

  let query = 'SELECT COUNT(*) as count FROM activities';
  const params: string[] = [];

  if (itemId) {
    query += ' WHERE item_id = ?';
    params.push(itemId);
  }

  const stmt = database.prepare(query);
  const result = stmt.get(...params) as { count: number };

  return result.count;
}

/**
 * Log a new activity and update item quantity
 * This is a transaction to ensure data consistency
 */
export function logActivity(
  itemId: string,
  type: ActivityType,
  amount: number,
  source: ActivitySource = 'MANUAL'
): Activity | null {
  const database = getDatabase();

  const item = getItemById(itemId);
  if (!item) return null;

  const id = uuidv4();
  const now = new Date().toISOString();

  // Calculate quantity adjustment based on activity type
  let quantityAdjustment = 0;
  let actualAmount = amount;

  switch (type) {
    case 'ADD':
      quantityAdjustment = amount;
      break;
    case 'REMOVE':
      quantityAdjustment = -amount;
      // Cap removal at available quantity
      actualAmount = Math.min(amount, item.quantity);
      break;
    case 'ADJUST':
      // For ADJUST, amount represents the delta (positive or negative)
      quantityAdjustment = amount;
      actualAmount = Math.abs(amount);
      break;
  }

  // Use transaction for atomicity
  const transaction = database.transaction(() => {
    // Create activity record with denormalized item name
    const activityStmt = database.prepare(`
      INSERT INTO activities (id, item_id, item_name, type, amount, timestamp, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    activityStmt.run(id, itemId, item.name, type, actualAmount, now, source);

    // Update item quantity
    const newQuantity = Math.max(0, item.quantity + quantityAdjustment);
    const updateStmt = database.prepare(`
      UPDATE pantry_items 
      SET quantity = ?, last_updated = ? 
      WHERE id = ?
    `);

    updateStmt.run(newQuantity, now, itemId);

    return {
      id,
      itemId,
      itemName: item.name,
      type,
      amount: actualAmount,
      timestamp: now,
      source,
    };
  });

  return transaction();
}

// ============================================================================
// Scan Receipt Operations
// ============================================================================

/**
 * Process receipt scan data and return standardized scan results
 * In production, this would integrate with OCR/ML services
 */
export function processReceiptScan(rawData: string | ScanResult[]): ScanResult[] {
  // If already structured data, validate and return
  if (Array.isArray(rawData)) {
    return rawData.filter((item) => item.name && item.quantity >= 0);
  }

  // Simple text parsing (mock implementation)
  // In production, this would use OCR + NLP to extract items
  return parseReceiptText(rawData);
}

/**
 * Mock text parser for receipt text
 * Real implementation would use ML/NLP
 */
function parseReceiptText(text: string): ScanResult[] {
  const lines = text.split('\n').filter((line) => line.trim());
  const results: ScanResult[] = [];

  for (const line of lines) {
    // Simple parsing: look for patterns like "Item Name $X.XX" or "Item Name X qty"
    const match = line.match(/(.+?)\s+(?:\$?\d+\.\d+|\d+)\s*(\w+)?/i);
    if (match) {
      const name = match[1].trim();
      const category = inferCategory(name);
      
      results.push({
        name,
        quantity: 1,
        unit: match[2] || 'pieces',
        category,
      });
    }
  }

  return results;
}

/**
 * Infer category from item name using keywords
 */
function inferCategory(name: string): string {
  const lowerName = name.toLowerCase();
  
  const categories: Record<string, string[]> = {
    produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'carrot'],
    dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg'],
    meat: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey'],
    bakery: ['bread', 'bagel', 'muffin', 'cake', 'roll'],
    pantry: ['rice', 'pasta', 'flour', 'sugar', 'oil', 'sauce'],
    beverages: ['water', 'soda', 'juice', 'coffee', 'tea'],
    frozen: ['frozen', 'ice cream', 'pizza'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => lowerName.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

// ============================================================================
// Visual Usage Operations
// ============================================================================

/**
 * Process visual usage detection results
 * Creates REMOVE activities for detected usage
 */
export function processVisualUsage(
  detections: UsageResult[],
  source: string = 'VISUAL_USAGE'
): { processed: UsageResult[]; activities: Activity[]; errors: string[] } {
  const results = {
    processed: [] as UsageResult[],
    activities: [] as Activity[],
    errors: [] as string[],
  };

  for (const detection of detections) {
    // Try to find matching item by name
    const item = getItemByName(detection.name);

    if (!item) {
      results.errors.push(`Item not found: ${detection.name}`);
      continue;
    }

    // Create REMOVE activity
    const activity = logActivity(
      item.id,
      'REMOVE',
      detection.quantityUsed,
      source as ActivitySource
    );

    if (activity) {
      results.processed.push(detection);
      results.activities.push(activity);
    } else {
      results.errors.push(`Failed to log usage for: ${detection.name}`);
    }
  }

  return results;
}

// ============================================================================
// Export for testing
// ============================================================================

export const dbExports = {
  initializeSchema,
  parseReceiptText,
  inferCategory,
};