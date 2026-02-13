"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAdapter = void 0;
const pg_1 = require("pg");
const uuid_1 = require("uuid");
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'pantry_pal';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_SSL = process.env.DB_SSL === 'true';
function mapPantryItemRow(row) {
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
function mapActivityRow(row) {
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
class PostgresAdapter {
    pool = null;
    initialize() {
        this.pool = new pg_1.Pool({
            host: DB_HOST,
            port: DB_PORT,
            database: DB_NAME,
            user: DB_USER,
            password: DB_PASSWORD,
            ssl: DB_SSL ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.pool.on('error', (err) => {
            console.error('Unexpected error on PostgreSQL client', err);
        });
        this.initializeSchema();
        this.initializeSubscriptionSchema();
        console.log('[DB] PostgreSQL connection pool initialized');
    }
    close() {
        if (this.pool) {
            this.pool.end();
            this.pool = null;
            console.log('[DB] PostgreSQL connection pool closed');
        }
    }
    getPool() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        return this.pool;
    }
    async initializeSchema() {
        const pool = this.getPool();
        const client = await pool.connect();
        try {
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
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
        CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);
        CREATE INDEX IF NOT EXISTS idx_pantry_items_name ON pantry_items(name);
        CREATE INDEX IF NOT EXISTS idx_pantry_items_barcode ON pantry_items(barcode);
        CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
        CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
        CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
      `);
            console.log('[DB] PostgreSQL schema initialized successfully');
        }
        finally {
            client.release();
        }
    }
    async initializeSubscriptionSchema() {
        const pool = this.getPool();
        const client = await pool.connect();
        try {
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
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON usage_limits(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_limits_user_month ON usage_limits(user_id, month);
      `);
            console.log('[DB] PostgreSQL subscription schema initialized');
        }
        finally {
            client.release();
        }
    }
    async getAllItems(userId, category) {
        const pool = this.getPool();
        let query = 'SELECT * FROM pantry_items WHERE user_id = $1';
        const params = [userId];
        if (category) {
            query += ' AND category = $2';
            params.push(category);
        }
        query += ' ORDER BY name';
        const result = await pool.query(query, params);
        return result.rows.map(mapPantryItemRow);
    }
    async getItemById(userId, id) {
        const pool = this.getPool();
        const result = await pool.query('SELECT * FROM pantry_items WHERE user_id = $1 AND id = $2', [userId, id]);
        return result.rows[0] ? mapPantryItemRow(result.rows[0]) : null;
    }
    async getItemByName(userId, name) {
        const pool = this.getPool();
        const result = await pool.query('SELECT * FROM pantry_items WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
        return result.rows[0] ? mapPantryItemRow(result.rows[0]) : null;
    }
    async createItem(userId, input) {
        const pool = this.getPool();
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await pool.query(`INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, userId, input.name, input.barcode || null, input.quantity, input.unit, input.category, now]);
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
    async updateItem(userId, id, input) {
        const pool = this.getPool();
        const existing = await this.getItemById(userId, id);
        if (!existing)
            return null;
        const now = new Date().toISOString();
        const updates = [];
        const params = [];
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
        updates.push(`last_updated = $${paramIndex++}`);
        params.push(now);
        params.push(userId);
        params.push(id);
        const query = `UPDATE pantry_items SET ${updates.join(', ')} WHERE user_id = $${paramIndex++} AND id = $${paramIndex++}`;
        await pool.query(query, params);
        return this.getItemById(userId, id);
    }
    async deleteItem(userId, id) {
        const pool = this.getPool();
        const result = await pool.query('DELETE FROM pantry_items WHERE user_id = $1 AND id = $2', [userId, id]);
        return (result.rowCount || 0) > 0;
    }
    async adjustItemQuantity(userId, id, adjustment) {
        const pool = this.getPool();
        const existing = await this.getItemById(userId, id);
        if (!existing)
            return null;
        const newQuantity = Math.max(0, existing.quantity + adjustment);
        const now = new Date().toISOString();
        await pool.query(`UPDATE pantry_items 
       SET quantity = $1, last_updated = $2 
       WHERE user_id = $3 AND id = $4`, [newQuantity, now, userId, id]);
        return this.getItemById(userId, id);
    }
    async getCategories(userId) {
        const pool = this.getPool();
        const result = await pool.query('SELECT DISTINCT category FROM pantry_items WHERE user_id = $1 ORDER BY category', [userId]);
        return result.rows.map((r) => r.category);
    }
    async getActivities(userId, limit = 20, offset = 0, itemId) {
        const pool = this.getPool();
        let query = 'SELECT * FROM activities WHERE user_id = $1';
        const params = [userId];
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
    async getActivityCount(userId, itemId) {
        const pool = this.getPool();
        let query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        if (itemId) {
            query += ` AND item_id = $${paramIndex++}`;
            params.push(itemId);
        }
        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count, 10);
    }
    async logActivity(userId, itemId, type, amount, source = 'MANUAL') {
        const pool = this.getPool();
        const item = await this.getItemById(userId, itemId);
        if (!item)
            return null;
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        let quantityAdjustment = 0;
        let actualAmount = amount;
        switch (type) {
            case 'ADD':
                quantityAdjustment = amount;
                break;
            case 'REMOVE':
                quantityAdjustment = -amount;
                actualAmount = Math.min(amount, item.quantity);
                break;
            case 'ADJUST':
                quantityAdjustment = amount;
                actualAmount = Math.abs(amount);
                break;
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            try {
                await client.query(`INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, userId, itemId, item.name, type, actualAmount, now, source]);
                const newQuantity = Math.max(0, item.quantity + quantityAdjustment);
                await client.query(`UPDATE pantry_items 
           SET quantity = $1, last_updated = $2 
           WHERE user_id = $3 AND id = $4`, [newQuantity, now, userId, itemId]);
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
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        finally {
            client.release();
        }
    }
    processReceiptScan(rawData) {
        if (Array.isArray(rawData)) {
            return rawData.filter((item) => item.name && item.quantity >= 0);
        }
        return this.parseReceiptText(rawData);
    }
    parseReceiptText(text) {
        const lines = text.split('\n').filter((line) => line.trim());
        const results = [];
        for (const line of lines) {
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
    inferCategory(name) {
        const lowerName = name.toLowerCase();
        const categories = {
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
    async processVisualUsage(userId, detections, source = 'VISUAL_USAGE') {
        const results = {
            processed: [],
            activities: [],
            errors: [],
        };
        for (const detection of detections) {
            const item = await this.getItemByName(userId, detection.name);
            if (!item) {
                results.errors.push(`Item not found: ${detection.name}`);
                continue;
            }
            const activity = await this.logActivity(userId, item.id, 'REMOVE', detection.quantityUsed, source);
            if (activity) {
                results.processed.push(detection);
                results.activities.push(activity);
            }
            else {
                results.errors.push(`Failed to log usage for: ${detection.name}`);
            }
        }
        return results;
    }
    async query(sql, params) {
        const pool = this.getPool();
        const result = await pool.query(sql, params);
        return result.rows;
    }
    async execute(sql, params) {
        const pool = this.getPool();
        const result = await pool.query(sql, params);
        return { changes: result.rowCount || 0 };
    }
    async transaction(fn) {
        const pool = this.getPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            try {
                const result = await fn();
                await client.query('COMMIT');
                return result;
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        finally {
            client.release();
        }
    }
}
exports.PostgresAdapter = PostgresAdapter;
//# sourceMappingURL=postgres.js.map