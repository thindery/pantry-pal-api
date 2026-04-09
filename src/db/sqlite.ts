/**
 * SQLite Database Adapter
 * Uses better-sqlite3 for high-performance synchronous operations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { runMigrations } from './migrate';
import { initializeSubscriptionSchema } from '../services/subscription';
import { DatabaseAdapter, CreateItemInput, UpdateItemInput, CreateSessionInput, AddSessionItemInput, CompleteSessionInput } from './adapter';
import {
  PantryItem,
  PantryItemRow,
  Activity,
  ActivityRow,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
  ProductInfo,
  ProductCacheInput,
} from '../models/types';
import {
  ShoppingSession,
  ShoppingSessionRow,
  SessionItem,
  SessionItemRow,
  ShoppingSessionWithItems,
  SessionSummary,
  SessionReceipt,
} from '../models/shoppingSession';

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================================================
// Row Mappers
// ============================================================================

function mapPantryItemRow(row: PantryItemRow): PantryItem {
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

function mapShoppingSessionRow(row: ShoppingSessionRow): ShoppingSession {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status,
    totalAmount: row.total_amount,
    itemCount: row.item_count,
    receiptUrl: row.receipt_url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionItemRow(row: SessionItemRow): SessionItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    barcode: row.barcode ?? undefined,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit ?? undefined,
    price: row.price ?? undefined,
    category: row.category ?? undefined,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
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

    // Product cache table for barcode lookups
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_cache (
        barcode TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT,
        category TEXT NOT NULL,
        image_url TEXT,
        ingredients TEXT,
        nutrition TEXT,
        source TEXT NOT NULL,
        info_last_synced TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Client Errors table for centralized error logging
    db.exec(`
      CREATE TABLE IF NOT EXISTS client_errors (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        component TEXT,
        url TEXT,
        user_agent TEXT,
        resolved BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      CREATE INDEX IF NOT EXISTS idx_product_cache_barcode ON product_cache(barcode);
      CREATE INDEX IF NOT EXISTS idx_product_cache_updated_at ON product_cache(updated_at);
      CREATE INDEX IF NOT EXISTS idx_client_errors_resolved ON client_errors(resolved);
      CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at);
    `);

    // Session Receipts table for storing receipt images
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_receipts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        image_data TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        notes TEXT,
        captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES shopping_sessions(id) ON DELETE CASCADE
      );
    `);

    // Indexes for session receipts
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_receipts_session_id ON session_receipts(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_receipts_captured_at ON session_receipts(captured_at);
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
    const rows = stmt.all(...params) as PantryItemRow[];
    
    // Debug logging to track persistence issues
    console.log(`[DB] getAllItems: userId=${userId}, category=${category || 'all'}, found=${rows.length} items`);

    return rows.map(mapPantryItemRow);
  }

  async getItemById(userId: string, id: string): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const stmt = db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND id = ?');
    const row = stmt.get(userId, id) as PantryItemRow | undefined;

    return row ? mapPantryItemRow(row) : null;
  }

  async getItemByName(userId: string, name: string): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const stmt = db.prepare(
      'SELECT * FROM pantry_items WHERE user_id = ? AND LOWER(name) = LOWER(?)'
    );
    const row = stmt.get(userId, name) as PantryItemRow | undefined;

    return row ? mapPantryItemRow(row) : null;
  }

  async getItemByBarcode(userId: string, barcode: string): Promise<PantryItem | null> {
    const db = this.getDatabase();

    const stmt = db.prepare(
      'SELECT * FROM pantry_items WHERE user_id = ? AND barcode = ?'
    );
    const row = stmt.get(userId, barcode) as PantryItemRow | undefined;

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
    const result = stmt.run(...params);
    
    // Debug logging to track persistence issues
    console.log(`[DB] updateItem: userId=${userId}, id=${id}, changes=${result.changes}`);

    // Verify the update actually worked
    if (result.changes === 0) {
      console.warn(`[DB] updateItem: No rows updated for userId=${userId}, id=${id}`);
      return null;
    }

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

    const result = stmt.run(newQuantity, now, userId, id);

    // Debug logging to track persistence issues
    console.log(`[DB] adjustItemQuantity: userId=${userId}, id=${id}, adjustment=${adjustment}, changes=${result.changes}`);

    // Verify the update actually worked
    if (result.changes === 0) {
      console.warn(`[DB] adjustItemQuantity: No rows updated for userId=${userId}, id=${id}`);
      return null;
    }

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

  // ==========================================================================
  // Barcode / Product Cache Operations
  // ==========================================================================

  async getProductByBarcode(barcode: string, maxAgeDays?: number): Promise<ProductInfo | null> {
    const db = this.getDatabase();

    // If maxAgeDays is specified, check cache freshness
    if (maxAgeDays !== undefined) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      const cutoffIso = cutoffDate.toISOString();

      const stmt = db.prepare(
        `SELECT * FROM product_cache 
         WHERE barcode = ? AND info_last_synced >= ?`
      );
      const row = stmt.get(barcode, cutoffIso) as {
        barcode: string;
        name: string;
        brand?: string;
        category: string;
        image_url?: string;
        ingredients?: string;
        nutrition?: string;
        source: string;
        info_last_synced: string;
      } | undefined;

      if (row) {
        return {
          barcode: row.barcode,
          name: row.name,
          brand: row.brand,
          category: row.category,
          imageUrl: row.image_url,
          ingredients: row.ingredients,
          nutrition: row.nutrition ? JSON.parse(row.nutrition) : undefined,
          source: row.source,
          infoLastSynced: row.info_last_synced,
        };
      }
      return null;
    }

    // No age limit - return any cached product
    const stmt = db.prepare('SELECT * FROM product_cache WHERE barcode = ?');
    const row = stmt.get(barcode) as {
      barcode: string;
      name: string;
      brand?: string;
      category: string;
      image_url?: string;
      ingredients?: string;
      nutrition?: string;
      source: string;
      info_last_synced: string;
    } | undefined;

    if (!row) return null;

    return {
      barcode: row.barcode,
      name: row.name,
      brand: row.brand,
      category: row.category,
      imageUrl: row.image_url,
      ingredients: row.ingredients,
      nutrition: row.nutrition ? JSON.parse(row.nutrition) : undefined,
      source: row.source,
      infoLastSynced: row.info_last_synced,
    };
  }

  async saveProduct(input: ProductCacheInput): Promise<void> {
    const db = this.getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO product_cache (
        barcode, name, brand, category, image_url, ingredients, 
        nutrition, source, info_last_synced, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        image_url = excluded.image_url,
        ingredients = excluded.ingredients,
        nutrition = excluded.nutrition,
        source = excluded.source,
        info_last_synced = excluded.info_last_synced,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      input.barcode,
      input.name,
      input.brand || null,
      input.category,
      input.imageUrl || null,
      input.ingredients || null,
      input.nutrition ? JSON.stringify(input.nutrition) : null,
      input.source,
      now,
      now
    );
  }

  // ==========================================================================
  // Client Error Operations
  // ==========================================================================

  async saveClientError(error: {
    userId?: string;
    errorType: string;
    errorMessage: string;
    errorStack?: string;
    component?: string;
    url?: string;
    userAgent?: string;
  }): Promise<{ id: string }> {
    const db = this.getDatabase();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO client_errors (id, user_id, error_type, error_message, error_stack, component, url, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      error.userId || null,
      error.errorType,
      error.errorMessage,
      error.errorStack || null,
      error.component || null,
      error.url || null,
      error.userAgent || null
    );

    return { id };
  }

  async getClientErrors(filters: {
    resolved?: boolean;
    limit?: number;
  }): Promise<Array<{
    id: string;
    user_id: string | null;
    error_type: string;
    error_message: string;
    error_stack: string | null;
    component: string | null;
    url: string | null;
    user_agent: string | null;
    resolved: boolean;
    created_at: string;
  }>> {
    const db = this.getDatabase();
    const limit = filters.limit || 50;

    let query = 'SELECT * FROM client_errors WHERE 1=1';
    const params: (string | number | boolean)[] = [];

    if (filters.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(filters.resolved ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    return stmt.all(...params) as Array<{
      id: string;
      user_id: string | null;
      error_type: string;
      error_message: string;
      error_stack: string | null;
      component: string | null;
      url: string | null;
      user_agent: string | null;
      resolved: boolean;
      created_at: string;
    }>;
  }

  async markErrorResolved(id: string): Promise<void> {
    const db = this.getDatabase();
    const stmt = db.prepare('UPDATE client_errors SET resolved = 1 WHERE id = ?');
    stmt.run(id);
  }

  // ==========================================================================
  // Shopping Session Operations
  // ==========================================================================

  async createSession(userId: string, input: CreateSessionInput): Promise<ShoppingSession> {
    const db = this.getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO shopping_sessions (
        id, user_id, store_name, started_at, status, total_amount, item_count, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', 0, 0, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      input.storeName || null,
      now,
      input.notes || null,
      now,
      now
    );

    return {
      id,
      userId,
      storeName: input.storeName,
      startedAt: now,
      status: 'active',
      totalAmount: 0,
      itemCount: 0,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getSessionById(userId: string, sessionId: string): Promise<ShoppingSessionWithItems | null> {
    const db = this.getDatabase();

    // Get session
    const sessionStmt = db.prepare(
      'SELECT * FROM shopping_sessions WHERE user_id = ? AND id = ?'
    );
    const sessionRow = sessionStmt.get(userId, sessionId) as ShoppingSessionRow | undefined;

    if (!sessionRow) {
      return null;
    }

    // Get items
    const itemsStmt = db.prepare(
      'SELECT * FROM session_items WHERE session_id = ? ORDER BY added_at DESC'
    );
    const itemRows = itemsStmt.all(sessionId) as SessionItemRow[];

    return {
      ...mapShoppingSessionRow(sessionRow),
      items: itemRows.map(mapSessionItemRow),
    };
  }

  async getUserSessions(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    status?: string
  ): Promise<ShoppingSession[]> {
    const db = this.getDatabase();

    let query = 'SELECT * FROM shopping_sessions WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as ShoppingSessionRow[];

    return rows.map(mapShoppingSessionRow);
  }

  async getSessionCount(userId: string, status?: string): Promise<number> {
    const db = this.getDatabase();

    let query = 'SELECT COUNT(*) as count FROM shopping_sessions WHERE user_id = ?';
    const params: (string)[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number } | undefined;

    return result?.count || 0;
  }

  async addSessionItem(
    userId: string,
    sessionId: string,
    input: AddSessionItemInput
  ): Promise<SessionItem> {
    const db = this.getDatabase();

    // Verify session belongs to user and is active
    const sessionStmt = db.prepare(
      'SELECT id FROM shopping_sessions WHERE id = ? AND user_id = ? AND status = ?'
    );
    const sessionRow = sessionStmt.get(sessionId, userId, 'active') as { id: string } | undefined;

    if (!sessionRow) {
      throw new Error('Session not found or not active');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Insert item
    const insertStmt = db.prepare(`
      INSERT INTO session_items (
        id, session_id, barcode, name, quantity, unit, price, category, added_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      sessionId,
      input.barcode || null,
      input.name,
      input.quantity,
      input.unit || null,
      input.price || null,
      input.category || null,
      now,
      now
    );

    // Update session totals
    const itemTotal = (input.price || 0) * input.quantity;
    const updateStmt = db.prepare(`
      UPDATE shopping_sessions 
      SET total_amount = total_amount + ?, 
          item_count = item_count + 1,
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(itemTotal, now, sessionId);

    return {
      id,
      sessionId,
      barcode: input.barcode,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
      category: input.category,
      addedAt: now,
      updatedAt: now,
    };
  }

  async removeSessionItem(_userId: string, sessionId: string, itemId: string): Promise<boolean> {
    const db = this.getDatabase();

    // Get item details before deletion (for total adjustment)
    const itemStmt = db.prepare(
      'SELECT quantity, price FROM session_items WHERE id = ? AND session_id = ?'
    );
    const itemRow = itemStmt.get(itemId, sessionId) as { quantity: number; price: number | null } | undefined;

    if (!itemRow) {
      return false;
    }

    // Delete item
    const deleteStmt = db.prepare('DELETE FROM session_items WHERE id = ? AND session_id = ?');
    const result = deleteStmt.run(itemId, sessionId);

    if (result.changes === 0) {
      return false;
    }

    // Update session totals
    const itemTotal = (itemRow.price || 0) * itemRow.quantity;
    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE shopping_sessions 
      SET total_amount = MAX(0, total_amount - ?), 
          item_count = MAX(0, item_count - 1),
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(itemTotal, now, sessionId);

    return true;
  }

  async completeSession(
    userId: string,
    sessionId: string,
    input: CompleteSessionInput
  ): Promise<ShoppingSession | null> {
    const db = this.getDatabase();
    const now = new Date().toISOString();

    // Verify session belongs to user and is active
    const sessionStmt = db.prepare(
      'SELECT * FROM shopping_sessions WHERE id = ? AND user_id = ? AND status = ?'
    );
    const sessionRow = sessionStmt.get(sessionId, userId, 'active') as ShoppingSessionRow | undefined;

    if (!sessionRow) {
      return null;
    }

    // Calculate final totals
    const itemsStmt = db.prepare(
      'SELECT SUM(price * quantity) as total FROM session_items WHERE session_id = ?'
    );
    const totalsResult = itemsStmt.get(sessionId) as { total: number | null } | undefined;
    const finalTotal = totalsResult?.total || sessionRow.total_amount;

    // Update session
    const updateStmt = db.prepare(`
      UPDATE shopping_sessions 
      SET status = 'completed',
          completed_at = ?,
          total_amount = ?,
          receipt_url = COALESCE(?, receipt_url),
          notes = COALESCE(?, notes),
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    updateStmt.run(
      now,
      finalTotal,
      input.receiptUrl || null,
      input.notes || null,
      now,
      sessionId,
      userId
    );

    return this.getSessionById(userId, sessionId);
  }

  async cancelSession(userId: string, sessionId: string): Promise<boolean> {
    const db = this.getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE shopping_sessions 
      SET status = 'cancelled',
          completed_at = ?,
          updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'active'
    `);

    const result = stmt.run(now, now, sessionId, userId);
    return result.changes > 0;
  }

  async getSessionSummary(userId: string): Promise<SessionSummary> {
    const db = this.getDatabase();

    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as avg_session_value
      FROM shopping_sessions 
      WHERE user_id = ? AND status = 'completed'
    `);

    const result = stmt.get(userId) as {
      total_sessions: number;
      total_spent: number;
      avg_session_value: number;
    } | undefined;

    return {
      totalSessions: result?.total_sessions || 0,
      totalSpent: result?.total_spent || 0,
      averageSessionValue: result?.avg_session_value || 0,
    };
  }

  async addSessionToInventory(
    userId: string,
    sessionId: string
  ): Promise<{ items: PantryItem[]; activities: Activity[] }> {
    const db = this.getDatabase();

    // Get the session with items
    const session = await this.getSessionById(userId, sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'completed') {
      throw new Error('Session must be completed before adding to inventory');
    }

    const items: PantryItem[] = [];
    const activities: Activity[] = [];

    // Process each session item with a barcode
    for (const sessionItem of session.items) {
      if (!sessionItem.barcode) {
        continue;
      }

      // Check if item already exists
      let existingItem = await this.getItemByBarcode(userId, sessionItem.barcode);

      if (existingItem) {
        // Update existing item quantity
        const updatedItem = await this.adjustItemQuantity(
          userId,
          existingItem.id,
          sessionItem.quantity
        );
        if (updatedItem) {
          items.push(updatedItem);
          // Log ADD activity
          const activity = await this.logActivity(
            userId,
            updatedItem.id,
            'ADD',
            sessionItem.quantity,
            'RECEIPT_SCAN'
          );
          if (activity) {
            activities.push(activity);
          }
        }
      } else {
        // Create new pantry item
        const newItem = await this.createItem(userId, {
          name: sessionItem.name,
          quantity: sessionItem.quantity,
          unit: sessionItem.unit || 'pieces',
          category: sessionItem.category || 'general',
          barcode: sessionItem.barcode,
        });
        items.push(newItem);
        // Log ADD activity
        const activity = await this.logActivity(
          userId,
          newItem.id,
          'ADD',
          sessionItem.quantity,
          'RECEIPT_SCAN'
        );
        if (activity) {
          activities.push(activity);
        }
      }
    }

    return { items, activities };
  }

  // ==========================================================================
  // Session Receipt Operations
  // ==========================================================================

  async captureSessionReceipt(
    userId: string,
    sessionId: string,
    imageData: string,
    mimeType: string,
    notes?: string
  ): Promise<SessionReceipt> {
    const db = this.getDatabase();

    // Verify session belongs to user
    const sessionCheck = db.prepare(
      'SELECT id FROM shopping_sessions WHERE id = ? AND user_id = ?'
    );
    const session = sessionCheck.get(sessionId, userId);

    if (!session) {
      throw new Error('Session not found');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO session_receipts (
        id, session_id, image_data, mime_type, notes, captured_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, sessionId, imageData, mimeType, notes || null, now, now);

    // Update session with receipt reference
    const updateStmt = db.prepare(
      'UPDATE shopping_sessions SET receipt_url = ?, updated_at = ? WHERE id = ?'
    );
    updateStmt.run(id, now, sessionId);

    return {
      id,
      sessionId,
      imageData,
      mimeType,
      notes,
      capturedAt: now,
      createdAt: now,
    };
  }

  async getSessionReceipts(
    userId: string,
    sessionId: string
  ): Promise<SessionReceipt[]> {
    const db = this.getDatabase();

    // Verify session belongs to user
    const sessionCheck = db.prepare(
      'SELECT id FROM shopping_sessions WHERE id = ? AND user_id = ?'
    );
    const session = sessionCheck.get(sessionId, userId);

    if (!session) {
      return [];
    }

    const stmt = db.prepare(
      'SELECT * FROM session_receipts WHERE session_id = ? ORDER BY captured_at DESC'
    );
    const rows = stmt.all(sessionId) as Array<{
      id: string;
      session_id: string;
      image_data: string;
      mime_type: string;
      notes: string | null;
      captured_at: string;
      created_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      imageData: row.image_data,
      mimeType: row.mime_type,
      notes: row.notes ?? undefined,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
    }));
  }

  async getSessionReceiptById(
    userId: string,
    sessionId: string,
    receiptId: string
  ): Promise<SessionReceipt | null> {
    const db = this.getDatabase();

    // Verify session belongs to user
    const sessionCheck = db.prepare(
      'SELECT id FROM shopping_sessions WHERE id = ? AND user_id = ?'
    );
    const session = sessionCheck.get(sessionId, userId);

    if (!session) {
      return null;
    }

    const stmt = db.prepare(
      'SELECT * FROM session_receipts WHERE id = ? AND session_id = ?'
    );
    const row = stmt.get(receiptId, sessionId) as {
      id: string;
      session_id: string;
      image_data: string;
      mime_type: string;
      notes: string | null;
      captured_at: string;
      created_at: string;
    } | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      imageData: row.image_data,
      mimeType: row.mime_type,
      notes: row.notes ?? undefined,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
    };
  }

  async deleteSessionReceipt(
    userId: string,
    sessionId: string,
    receiptId: string
  ): Promise<boolean> {
    const db = this.getDatabase();

    // Verify session belongs to user
    const sessionCheck = db.prepare(
      'SELECT id FROM shopping_sessions WHERE id = ? AND user_id = ?'
    );
    const session = sessionCheck.get(sessionId, userId);

    if (!session) {
      return false;
    }

    const stmt = db.prepare(
      'DELETE FROM session_receipts WHERE id = ? AND session_id = ?'
    );
    const result = stmt.run(receiptId, sessionId);

    return result.changes > 0;
  }
}
