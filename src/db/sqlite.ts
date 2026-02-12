/**
 * SQLite Database Adapter
 * Uses better-sqlite3 for high-performance synchronous operations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { runMigrations } from './migrate';
import { initializeSubscriptionSchema } from '../services/subscription';
import { DatabaseAdapter, CreateItemInput, UpdateItemInput } from './adapter';
import {
  PantryItem,
  PantryItemRow,
  Activity,
  ActivityRow,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
} from '../models/types';

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================================================
// Row Mappers
// ============================================================================

function mapPantryItemRow(row: PantryItemRow & { barcode?: string | null }): PantryItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    barcode: row.barcode ?? undefined,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    lastUpdated: row.last_updated,
  };
}

function mapActivityRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.type,
    amount: row.amount,
    timestamp: row.timestamp,
    source: row.source,
  };
}

// ============================================================================
// SQLite Adapter Class
// ============================================================================

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;

  initialize(): void {
    // Run migrations first to ensure schema is up-to-date
    runMigrations(DB_PATH);

    this.db = new Database(DB_PATH, {
      verbose: isDevelopment ? console.log : undefined,
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Initialize schema (creates new tables if they don't exist)
    this.initializeSchema();
    initializeSubscriptionSchema(this.db);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  private initializeSchema(): void {
    const db = this.getDatabase();

    // Pantry items table with user_id column
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

    // Activities table with user_id column and foreign key to pantry_items
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

    // Indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);
      CREATE INDEX IF NOT EXISTS idx_pantry_items_name ON pantry_items(name);
      CREATE INDEX IF NOT EXISTS idx_pantry_items_barcode ON pantry_items(barcode);
      CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
    `);

    console.log('[DB] SQLite schema initialized successfully');
  }

  // ==========================================================================
  // Pantry Item Operations
  // ==========================================================================

  async getAllItems(userId: string, category?: string): Promise<PantryItem[]> {
    const db = this.getDatabase();

    let query = 'SELECT * FROM pantry_items WHERE user_id = ?';
    const params: (string | undefined)[] = [userId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY name COLLATE NOCASE';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as (PantryItemRow & { barcode?: string | null })[];
    
    // Debug logging to track persistence issues
    console.log(`[DB] getAllItems: userId=${userId}, category=${category || 'all'}, found=${rows.length} items`);

    return rows.map(mapPantryItemRow);
  }

  async getItemById(userId: string, id: string): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const stmt = db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND id = ?');
    const row = stmt.get(userId, id) as (PantryItemRow & { barcode?: string | null }) | undefined;

    return row ? mapPantryItemRow(row) : null;
  }

  async getItemByName(userId: string, name: string): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const stmt = db.prepare(
      'SELECT * FROM pantry_items WHERE user_id = ? AND LOWER(name) = LOWER(?)'
    );
    const row = stmt.get(userId, name) as (PantryItemRow & { barcode?: string | null }) | undefined;

    return row ? mapPantryItemRow(row) : null;
  }

  async createItem(userId: string, input: CreateItemInput): Promise<PantryItem> {
    const db = this.getDatabase();

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(id, userId, input.name, input.barcode || null, input.quantity, input.unit, input.category, now);
    
    // Debug logging to track persistence issues
    console.log(`[DB] createItem: inserted id=${id}, changes=${result.changes}, lastInsertRowid=${result.lastInsertRowid}`);
    
    // Verify the insert actually worked
    if (result.changes === 0) {
      throw new Error('Failed to insert item: no rows affected');
    }

    return {
      id,
      userId,
      name: input.name,
      barcode: input.barcode,
      quantity: input.quantity,
      unit: input.unit,
      category: input.category,
      lastUpdated: now,
    };
  }

  async updateItem(userId: string, id: string, input: UpdateItemInput): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const existing = await this.getItemById(userId, id);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.barcode !== undefined) {
      updates.push('barcode = ?');
      params.push(input.barcode || null);
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

    // Add user_id and id to params for WHERE clause
    params.push(userId);
    params.push(id);

    const query = `UPDATE pantry_items SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`;
    const stmt = db.prepare(query);
    stmt.run(...params);

    return this.getItemById(userId, id);
  }

  async deleteItem(userId: string, id: string): Promise<boolean> {
    const db = this.getDatabase();

    const stmt = db.prepare('DELETE FROM pantry_items WHERE user_id = ? AND id = ?');
    const result = stmt.run(userId, id);

    return result.changes > 0;
  }

  async adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const existing = await this.getItemById(userId, id);
    if (!existing) return null;

    const newQuantity = Math.max(0, existing.quantity + adjustment);
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE pantry_items 
      SET quantity = ?, last_updated = ? 
      WHERE user_id = ? AND id = ?
    `);

    stmt.run(newQuantity, now, userId, id);

    return this.getItemById(userId, id);
  }

  async getCategories(userId: string): Promise<string[]> {
    const db = this.getDatabase();

    const stmt = db.prepare(
      'SELECT DISTINCT category FROM pantry_items WHERE user_id = ? ORDER BY category COLLATE NOCASE'
    );
    const rows = stmt.all(userId) as { category: string }[];

    return rows.map((r) => r.category);
  }

  // ==========================================================================
  // Activity Operations
  // ==========================================================================

  async getActivities(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    itemId?: string
  ): Promise<Activity[]> {
    const db = this.getDatabase();

    let query = 'SELECT * FROM activities WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (itemId) {
      query += ' AND item_id = ?';
      params.push(itemId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as ActivityRow[];

    return rows.map(mapActivityRow);
  }

  async getActivityCount(userId: string, itemId?: string): Promise<number> {
    const db = this.getDatabase();

    let query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
    const params: string[] = [userId];

    if (itemId) {
      query += ' AND item_id = ?';
      params.push(itemId);
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number };

    return result.count;
  }

  async logActivity(
    userId: string,
    itemId: string,
    type: ActivityType,
    amount: number,
    source: ActivitySource = 'MANUAL'
  ): Promise<Activity | null> {
    const db = this.getDatabase();

    const item = await this.getItemById(userId, itemId);
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
    const transaction = db.transaction(() => {
      // Create activity record with denormalized item name
      const activityStmt = db.prepare(`
        INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      activityStmt.run(id, userId, itemId, item.name, type, actualAmount, now, source);

      // Update item quantity
      const newQuantity = Math.max(0, item.quantity + quantityAdjustment);
      const updateStmt = db.prepare(`
        UPDATE pantry_items 
        SET quantity = ?, last_updated = ? 
        WHERE user_id = ? AND id = ?
      `);

      updateStmt.run(newQuantity, now, userId, itemId);

      return {
        id,
        userId,
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

  // ==========================================================================
  // Scan Receipt Operations
  // ==========================================================================

  processReceiptScan(rawData: string | ScanResult[]): ScanResult[] {
    // If already structured data, validate and return
    if (Array.isArray(rawData)) {
      return rawData.filter((item) => item.name && item.quantity >= 0);
    }

    // Simple text parsing (mock implementation)
    return this.parseReceiptText(rawData);
  }

  private parseReceiptText(text: string): ScanResult[] {
    const lines = text.split('\n').filter((line) => line.trim());
    const results: ScanResult[] = [];

    for (const line of lines) {
      // Simple parsing: look for patterns like "Item Name $X.XX" or "Item Name X qty"
      const match = line.match(/(.+?)\s+(?:\$?\d+\.\d+|\d+)\s*(\w+)?/i);
      if (match) {
        const name = match[1].trim();
        const category = this.inferCategory(name);
        
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

  private inferCategory(name: string): string {
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

  // ==========================================================================
  // Visual Usage Operations
  // ==========================================================================

  async processVisualUsage(
    userId: string,
    detections: UsageResult[],
    source: string = 'VISUAL_USAGE'
  ): Promise<{ processed: UsageResult[]; activities: Activity[]; errors: string[] }> {
    const results = {
      processed: [] as UsageResult[],
      activities: [] as Activity[],
      errors: [] as string[],
    };

    for (const detection of detections) {
      // Try to find matching item by name for this user
      const item = await this.getItemByName(userId, detection.name);

      if (!item) {
        results.errors.push(`Item not found: ${detection.name}`);
        continue;
      }

      // Create REMOVE activity
      const activity = await this.logActivity(
        userId,
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

  // ==========================================================================
  // Raw Query Access (for subscription service)
  // ==========================================================================

  query(sql: string, params?: unknown[]): unknown[] {
    const db = this.getDatabase();
    const stmt = db.prepare(sql);
    return stmt.all(...(params || []));
  }

  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastID?: string | number }> {
    const db = this.getDatabase();
    const stmt = db.prepare(sql);
    const result = stmt.run(...(params || []));
    return Promise.resolve({ 
      changes: result.changes, 
      lastID: typeof result.lastInsertRowid === 'bigint' 
        ? Number(result.lastInsertRowid) 
        : result.lastInsertRowid 
    });
  }

  transaction<T>(fn: () => T): T {
    const db = this.getDatabase();
    return db.transaction(fn)();
  }
}
