/**
 * PostgreSQL Database Adapter
 * Uses pg for PostgreSQL operations
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
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
  ProductInfo,
  ProductCacheInput,
} from '../models/types';

// ============================================================================
// Configuration
// ============================================================================

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'pantry_pal';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_SSL = process.env.DB_SSL === 'true';

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
// PostgreSQL Adapter Class
// ============================================================================

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;

  initialize(): void {
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
}
