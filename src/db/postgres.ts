/**
 * PostgreSQL Database Adapter
 * Uses pg for PostgreSQL operations
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
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

// DATABASE_URL takes precedence (set by Railway, Render, etc.)
const DATABASE_URL = process.env.DATABASE_URL;

// Individual config vars for local development
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'pantry_pal';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
// Default to SSL in production (DATABASE_URL typically includes SSL)
const DB_SSL = process.env.DB_SSL === 'true' || (!!DATABASE_URL && process.env.NODE_ENV === 'production');

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
// PostgreSQL Adapter Class
// ============================================================================

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;

  initialize(): void {
    // Use DATABASE_URL if available (Railway, Render, etc.)
    if (DATABASE_URL) {
      this.pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('[DB] Using DATABASE_URL for PostgreSQL connection');
    } else {
      this.pool = new Pool({
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: DB_SSL ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('[DB] Using individual DB config for PostgreSQL connection');
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on PostgreSQL client', err);
    });

    // Initialize schema
    this.initializeSchema();
    this.initializeSubscriptionSchema();

    console.log('[DB] PostgreSQL connection pool initialized');
  }

  close(): void {
    if (this.pool) {
      this.pool.end();
      this.pool = null;
      console.log('[DB] PostgreSQL connection pool closed');
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return this.pool;
  }

  private async initializeSchema(): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      // Pantry items table with user_id column
      await client.query(`
        CREATE TABLE IF NOT EXISTS pantry_items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          barcode TEXT,
          quantity REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL,
          category TEXT NOT NULL,
          last_updated TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Activities table with user_id column and foreign key to pantry_items
      await client.query(`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
          item_name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('ADD', 'REMOVE', 'ADJUST')),
          amount REAL NOT NULL,
          timestamp TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Product cache table for barcode lookups
      await client.query(`
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
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Client Errors table for centralized error logging
      await client.query(`
        CREATE TABLE IF NOT EXISTS client_errors (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          component TEXT,
          url TEXT,
          user_agent TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Indexes for performance
      await client.query(`
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

      console.log('[DB] PostgreSQL schema initialized successfully');
    } finally {
      client.release();
    }
  }

  private async initializeSubscriptionSchema(): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      // User subscriptions table
      await client.query(`
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
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Usage limits table
      await client.query(`
        CREATE TABLE IF NOT EXISTS usage_limits (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          month TEXT NOT NULL,
          receipt_scans INTEGER DEFAULT 0,
          ai_calls INTEGER DEFAULT 0,
          voice_sessions INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, month)
        );
      `);

      // Indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON usage_limits(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_limits_user_month ON usage_limits(user_id, month);
      `);

      console.log('[DB] PostgreSQL subscription schema initialized');
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // Pantry Item Operations
  // ==========================================================================

  async getAllItems(userId: string, category?: string): Promise<PantryItem[]> {
    const pool = this.getPool();

    let query = 'SELECT * FROM pantry_items WHERE user_id = $1';
    const params: (string | undefined)[] = [userId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);

    return result.rows.map(mapPantryItemRow);
  }

  async getItemById(userId: string, id: string): Promise<PantryItem | null> {
    const pool = this.getPool();

    const result = await pool.query(
      'SELECT * FROM pantry_items WHERE user_id = $1 AND id = $2',
      [userId, id]
    );

    return result.rows[0] ? mapPantryItemRow(result.rows[0]) : null;
  }

  async getItemByName(userId: string, name: string): Promise<PantryItem | null> {
    const pool = this.getPool();

    const result = await pool.query(
      'SELECT * FROM pantry_items WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [userId, name]
    );

    return result.rows[0] ? mapPantryItemRow(result.rows[0]) : null;
  }

  async createItem(userId: string, input: CreateItemInput): Promise<PantryItem> {
    const pool = this.getPool();

    const id = uuidv4();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, userId, input.name, input.barcode || null, input.quantity, input.unit, input.category, now]
    );

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
    const pool = this.getPool();

    const existing = await this.getItemById(userId, id);
    if (!existing) return null;

    const now = new Date().toISOString();

    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.barcode !== undefined) {
      updates.push(`barcode = $${paramIndex++}`);
      params.push(input.barcode || null);
    }
    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`);
      params.push(input.quantity);
    }
    if (input.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      params.push(input.unit);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(input.category);
    }

    // Always update last_updated
    updates.push(`last_updated = $${paramIndex++}`);
    params.push(now);

    // Add user_id and id to params for WHERE clause
    params.push(userId);
    params.push(id);

    const query = `UPDATE pantry_items SET ${updates.join(', ')} WHERE user_id = $${paramIndex++} AND id = $${paramIndex++}`;
    await pool.query(query, params);

    return this.getItemById(userId, id);
  }

  async deleteItem(userId: string, id: string): Promise<boolean> {
    const pool = this.getPool();

    const result = await pool.query(
      'DELETE FROM pantry_items WHERE user_id = $1 AND id = $2',
      [userId, id]
    );

    return (result.rowCount || 0) > 0;
  }

  async adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null> {
    const pool = this.getPool();

    const existing = await this.getItemById(userId, id);
    if (!existing) return null;

    const newQuantity = Math.max(0, existing.quantity + adjustment);
    const now = new Date().toISOString();

    await pool.query(
      `UPDATE pantry_items 
       SET quantity = $1, last_updated = $2 
       WHERE user_id = $3 AND id = $4`,
      [newQuantity, now, userId, id]
    );

    return this.getItemById(userId, id);
  }

  async getCategories(userId: string): Promise<string[]> {
    const pool = this.getPool();

    const result = await pool.query(
      'SELECT DISTINCT category FROM pantry_items WHERE user_id = $1 ORDER BY category',
      [userId]
    );

    return result.rows.map((r) => r.category);
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
    const pool = this.getPool();

    let query = 'SELECT * FROM activities WHERE user_id = $1';
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (itemId) {
      query += ` AND item_id = $${paramIndex++}`;
      params.push(itemId);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return result.rows.map(mapActivityRow);
  }

  async getActivityCount(userId: string, itemId?: string): Promise<number> {
    const pool = this.getPool();

    let query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = $1';
    const params: string[] = [userId];
    let paramIndex = 2;

    if (itemId) {
      query += ` AND item_id = $${paramIndex++}`;
      params.push(itemId);
    }

    const result = await pool.query(query, params);

    return parseInt(result.rows[0].count, 10);
  }

  async logActivity(
    userId: string,
    itemId: string,
    type: ActivityType,
    amount: number,
    source: ActivitySource = 'MANUAL'
  ): Promise<Activity | null> {
    const pool = this.getPool();

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

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      try {
        // Create activity record with denormalized item name
        await client.query(
          `INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, userId, itemId, item.name, type, actualAmount, now, source]
        );

        // Update item quantity
        const newQuantity = Math.max(0, item.quantity + quantityAdjustment);
        await client.query(
          `UPDATE pantry_items 
           SET quantity = $1, last_updated = $2 
           WHERE user_id = $3 AND id = $4`,
          [newQuantity, now, userId, itemId]
        );

        await client.query('COMMIT');

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
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
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

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    const pool = this.getPool();
    const result = await pool.query(sql, params);
    return result.rows;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastID?: string | number }> {
    const pool = this.getPool();
    const result = await pool.query(sql, params);
    return { changes: result.rowCount || 0 };
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      try {
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // Barcode / Product Cache Operations
  // ==========================================================================

  async getProductByBarcode(barcode: string, maxAgeDays?: number): Promise<ProductInfo | null> {
    const pool = this.getPool();

    // If maxAgeDays is specified, check cache freshness
    if (maxAgeDays !== undefined) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      const cutoffIso = cutoffDate.toISOString();

      const result = await pool.query(
        `SELECT * FROM product_cache 
         WHERE barcode = $1 AND info_last_synced >= $2`,
        [barcode, cutoffIso]
      );

      const row = result.rows[0] as {
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
    const result = await pool.query(
      'SELECT * FROM product_cache WHERE barcode = $1',
      [barcode]
    );

    const row = result.rows[0] as {
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
    const pool = this.getPool();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO product_cache (
        barcode, name, brand, category, image_url, ingredients, 
        nutrition, source, info_last_synced, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(barcode) DO UPDATE SET
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        image_url = EXCLUDED.image_url,
        ingredients = EXCLUDED.ingredients,
        nutrition = EXCLUDED.nutrition,
        source = EXCLUDED.source,
        info_last_synced = EXCLUDED.info_last_synced,
        updated_at = EXCLUDED.updated_at`,
      [
        input.barcode,
        input.name,
        input.brand || null,
        input.category,
        input.imageUrl || null,
        input.ingredients || null,
        input.nutrition ? JSON.stringify(input.nutrition) : null,
        input.source,
        now,
        now,
      ]
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
    const pool = this.getPool();
    const id = uuidv4();

    await pool.query(
      `INSERT INTO client_errors (id, user_id, error_type, error_message, error_stack, component, url, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        error.userId || null,
        error.errorType,
        error.errorMessage,
        error.errorStack || null,
        error.component || null,
        error.url || null,
        error.userAgent || null,
      ]
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
    const pool = this.getPool();
    const limit = filters.limit || 50;

    let query = 'SELECT * FROM client_errors WHERE 1=1';
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (filters.resolved !== undefined) {
      query += ` AND resolved = $${paramIndex++}`;
      params.push(filters.resolved ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows as Array<{
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
    const pool = this.getPool();
    await pool.query('UPDATE client_errors SET resolved = 1 WHERE id = $1', [id]);
  }

  // ==========================================================================
  // Shopping Session Operations
  // ==========================================================================

  async createSession(userId: string, input: CreateSessionInput): Promise<ShoppingSession> {
    const pool = this.getPool();
    const id = uuidv4();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO shopping_sessions (
        id, user_id, store_name, started_at, status, total_amount, item_count, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, input.storeName || null, now, 'active', 0, 0, input.notes || null, now, now]
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
    const pool = this.getPool();

    // Get session
    const sessionResult = await pool.query(
      'SELECT * FROM shopping_sessions WHERE user_id = $1 AND id = $2',
      [userId, sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const sessionRow = sessionResult.rows[0] as ShoppingSessionRow;

    // Get items
    const itemsResult = await pool.query(
      'SELECT * FROM session_items WHERE session_id = $1 ORDER BY added_at DESC',
      [sessionId]
    );

    return {
      ...mapShoppingSessionRow(sessionRow),
      items: itemsResult.rows.map(mapSessionItemRow),
    };
  }

  async getUserSessions(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    status?: string
  ): Promise<ShoppingSession[]> {
    const pool = this.getPool();

    let query = 'SELECT * FROM shopping_sessions WHERE user_id = $1';
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map(mapShoppingSessionRow);
  }

  async getSessionCount(userId: string, status?: string): Promise<number> {
    const pool = this.getPool();

    let query = 'SELECT COUNT(*) as count FROM shopping_sessions WHERE user_id = $1';
    const params: (string)[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async addSessionItem(
    userId: string,
    sessionId: string,
    input: AddSessionItemInput
  ): Promise<SessionItem> {
    const pool = this.getPool();

    // Verify session belongs to user and is active
    const sessionResult = await pool.query(
      'SELECT id FROM shopping_sessions WHERE id = $1 AND user_id = $2 AND status = $3',
      [sessionId, userId, 'active']
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found or not active');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Insert item
    await pool.query(
      `INSERT INTO session_items (
        id, session_id, barcode, name, quantity, unit, price, category, added_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, sessionId, input.barcode || null, input.name, input.quantity, input.unit || null, input.price || null, input.category || null, now, now]
    );

    // Update session totals
    const itemTotal = (input.price || 0) * input.quantity;
    await pool.query(
      `UPDATE shopping_sessions 
       SET total_amount = total_amount + $1, 
           item_count = item_count + 1,
           updated_at = $2
       WHERE id = $3`,
      [itemTotal, now, sessionId]
    );

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
    const pool = this.getPool();

    // Get item details before deletion (for total adjustment)
    const itemResult = await pool.query(
      'SELECT quantity, price FROM session_items WHERE id = $1 AND session_id = $2',
      [itemId, sessionId]
    );

    if (itemResult.rows.length === 0) {
      return false;
    }

    const itemRow = itemResult.rows[0] as { quantity: number; price: number | null };

    // Delete item
    const deleteResult = await pool.query(
      'DELETE FROM session_items WHERE id = $1 AND session_id = $2',
      [itemId, sessionId]
    );

    if (deleteResult.rowCount === 0) {
      return false;
    }

    // Update session totals
    const itemTotal = (itemRow.price || 0) * itemRow.quantity;
    const now = new Date().toISOString();
    await pool.query(
      `UPDATE shopping_sessions 
       SET total_amount = GREATEST(0, total_amount - $1), 
           item_count = GREATEST(0, item_count - 1),
           updated_at = $2
       WHERE id = $3`,
      [itemTotal, now, sessionId]
    );

    return true;
  }

  async completeSession(
    userId: string,
    sessionId: string,
    input: CompleteSessionInput
  ): Promise<ShoppingSession | null> {
    const pool = this.getPool();
    const now = new Date().toISOString();

    // Verify session belongs to user and is active
    const sessionResult = await pool.query(
      'SELECT * FROM shopping_sessions WHERE id = $1 AND user_id = $2 AND status = $3',
      [sessionId, userId, 'active']
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const sessionRow = sessionResult.rows[0] as ShoppingSessionRow;

    // Calculate final totals
    const totalsResult = await pool.query(
      'SELECT SUM(price * quantity) as total FROM session_items WHERE session_id = $1',
      [sessionId]
    );
    const finalTotal = totalsResult.rows[0]?.total || sessionRow.total_amount;

    // Update session
    await pool.query(
      `UPDATE shopping_sessions 
       SET status = 'completed',
           completed_at = $1,
           total_amount = $2,
           receipt_url = COALESCE($3, receipt_url),
           notes = COALESCE($4, notes),
           updated_at = $5
       WHERE id = $6 AND user_id = $7`,
      [now, finalTotal, input.receiptUrl || null, input.notes || null, now, sessionId, userId]
    );

    return this.getSessionById(userId, sessionId);
  }

  async cancelSession(userId: string, sessionId: string): Promise<boolean> {
    const pool = this.getPool();
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE shopping_sessions 
       SET status = 'cancelled',
           completed_at = $1,
           updated_at = $2
       WHERE id = $3 AND user_id = $4 AND status = 'active'`,
      [now, now, sessionId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getSessionSummary(userId: string): Promise<SessionSummary> {
    const pool = this.getPool();

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(AVG(total_amount), 0) as avg_session_value
      FROM shopping_sessions 
      WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    const row = result.rows[0] as {
      total_sessions: string;
      total_spent: string;
      avg_session_value: string;
    } | undefined;

    return {
      totalSessions: parseInt(row?.total_sessions || '0', 10),
      totalSpent: parseFloat(row?.total_spent || '0'),
      averageSessionValue: parseFloat(row?.avg_session_value || '0'),
    };
  }

  async addSessionToInventory(
    userId: string,
    sessionId: string
  ): Promise<{ items: PantryItem[]; activities: Activity[] }> {
    const pool = this.getPool();

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

      // Check if item already exists by barcode
      const existingResult = await pool.query(
        'SELECT * FROM pantry_items WHERE user_id = $1 AND barcode = $2',
        [userId, sessionItem.barcode]
      );

      if (existingResult.rows.length > 0) {
        // Update existing item quantity
        const existingRow = existingResult.rows[0] as PantryItemRow;
        const newQuantity = existingRow.quantity + sessionItem.quantity;
        const now = new Date().toISOString();

        await pool.query(
          'UPDATE pantry_items SET quantity = $1, last_updated = $2 WHERE user_id = $3 AND id = $4',
          [newQuantity, now, userId, existingRow.id]
        );

        const updatedItem = await this.getItemById(userId, existingRow.id);
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
        const id = uuidv4();
        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, userId, sessionItem.name, sessionItem.barcode, sessionItem.quantity,
           sessionItem.unit || 'pieces', sessionItem.category || 'general', now]
        );

        const newItem = await this.getItemById(userId, id);
        if (newItem) {
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
    const pool = this.getPool();

    // Verify session belongs to user
    const sessionResult = await pool.query(
      'SELECT id FROM shopping_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Insert receipt
    await pool.query(
      `INSERT INTO session_receipts (
        id, session_id, image_data, mime_type, notes, captured_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, sessionId, imageData, mimeType, notes || null, now, now]
    );

    // Update session with receipt reference
    await pool.query(
      'UPDATE shopping_sessions SET receipt_url = $1, updated_at = $2 WHERE id = $3',
      [id, now, sessionId]
    );

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
    const pool = this.getPool();

    // Verify session belongs to user
    const sessionResult = await pool.query(
      'SELECT id FROM shopping_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return [];
    }

    const result = await pool.query(
      'SELECT * FROM session_receipts WHERE session_id = $1 ORDER BY captured_at DESC',
      [sessionId]
    );

    return result.rows.map(row => ({
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
    const pool = this.getPool();

    // Verify session belongs to user
    const sessionResult = await pool.query(
      'SELECT id FROM shopping_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const result = await pool.query(
      'SELECT * FROM session_receipts WHERE id = $1 AND session_id = $2',
      [receiptId, sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
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
    const pool = this.getPool();

    // Verify session belongs to user
    const sessionResult = await pool.query(
      'SELECT id FROM shopping_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return false;
    }

    const result = await pool.query(
      'DELETE FROM session_receipts WHERE id = $1 AND session_id = $2',
      [receiptId, sessionId]
    );

    return (result.rowCount ?? 0) > 0;
  }
}
