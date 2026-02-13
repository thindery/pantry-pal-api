"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteAdapter = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const uuid_1 = require("uuid");
const migrate_1 = require("./migrate");
const subscription_1 = require("../services/subscription");
const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const isDevelopment = process.env.NODE_ENV !== 'production';
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
class SQLiteAdapter {
    db = null;
    initialize() {
        (0, migrate_1.runMigrations)(DB_PATH);
        this.db = new better_sqlite3_1.default(DB_PATH, {
            verbose: isDevelopment ? console.log : undefined,
        });
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.initializeSchema();
        (0, subscription_1.initializeSubscriptionSchema)(this.db);
    }
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
    getDatabase() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }
    initializeSchema() {
        const db = this.getDatabase();
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
        console.log('[DB] SQLite schema initialized successfully');
    }
    async getAllItems(userId, category) {
        const db = this.getDatabase();
        let query = 'SELECT * FROM pantry_items WHERE user_id = ?';
        const params = [userId];
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        query += ' ORDER BY name COLLATE NOCASE';
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        console.log(`[DB] getAllItems: userId=${userId}, category=${category || 'all'}, found=${rows.length} items`);
        return rows.map(mapPantryItemRow);
    }
    async getItemById(userId, id) {
        const db = this.getDatabase();
        const stmt = db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND id = ?');
        const row = stmt.get(userId, id);
        return row ? mapPantryItemRow(row) : null;
    }
    async getItemByName(userId, name) {
        const db = this.getDatabase();
        const stmt = db.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND LOWER(name) = LOWER(?)');
        const row = stmt.get(userId, name);
        return row ? mapPantryItemRow(row) : null;
    }
    async createItem(userId, input) {
        const db = this.getDatabase();
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(id, userId, input.name, input.barcode || null, input.quantity, input.unit, input.category, now);
        console.log(`[DB] createItem: inserted id=${id}, changes=${result.changes}, lastInsertRowid=${result.lastInsertRowid}`);
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
    async updateItem(userId, id, input) {
        const db = this.getDatabase();
        const existing = await this.getItemById(userId, id);
        if (!existing)
            return null;
        const now = new Date().toISOString();
        const updates = [];
        const params = [];
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
        updates.push('last_updated = ?');
        params.push(now);
        params.push(userId);
        params.push(id);
        const query = `UPDATE pantry_items SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`;
        const stmt = db.prepare(query);
        const result = stmt.run(...params);
        console.log(`[DB] updateItem: userId=${userId}, id=${id}, changes=${result.changes}`);
        if (result.changes === 0) {
            console.warn(`[DB] updateItem: No rows updated for userId=${userId}, id=${id}`);
            return null;
        }
        return this.getItemById(userId, id);
    }
    async deleteItem(userId, id) {
        const db = this.getDatabase();
        const stmt = db.prepare('DELETE FROM pantry_items WHERE user_id = ? AND id = ?');
        const result = stmt.run(userId, id);
        return result.changes > 0;
    }
    async adjustItemQuantity(userId, id, adjustment) {
        const db = this.getDatabase();
        const existing = await this.getItemById(userId, id);
        if (!existing)
            return null;
        const newQuantity = Math.max(0, existing.quantity + adjustment);
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      UPDATE pantry_items 
      SET quantity = ?, last_updated = ? 
      WHERE user_id = ? AND id = ?
    `);
        const result = stmt.run(newQuantity, now, userId, id);
        console.log(`[DB] adjustItemQuantity: userId=${userId}, id=${id}, adjustment=${adjustment}, changes=${result.changes}`);
        if (result.changes === 0) {
            console.warn(`[DB] adjustItemQuantity: No rows updated for userId=${userId}, id=${id}`);
            return null;
        }
        return this.getItemById(userId, id);
    }
    async getCategories(userId) {
        const db = this.getDatabase();
        const stmt = db.prepare('SELECT DISTINCT category FROM pantry_items WHERE user_id = ? ORDER BY category COLLATE NOCASE');
        const rows = stmt.all(userId);
        return rows.map((r) => r.category);
    }
    async getActivities(userId, limit = 20, offset = 0, itemId) {
        const db = this.getDatabase();
        let query = 'SELECT * FROM activities WHERE user_id = ?';
        const params = [userId];
        if (itemId) {
            query += ' AND item_id = ?';
            params.push(itemId);
        }
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(mapActivityRow);
    }
    async getActivityCount(userId, itemId) {
        const db = this.getDatabase();
        let query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
        const params = [userId];
        if (itemId) {
            query += ' AND item_id = ?';
            params.push(itemId);
        }
        const stmt = db.prepare(query);
        const result = stmt.get(...params);
        return result.count;
    }
    async logActivity(userId, itemId, type, amount, source = 'MANUAL') {
        const db = this.getDatabase();
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
        const transaction = db.transaction(() => {
            const activityStmt = db.prepare(`
        INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            activityStmt.run(id, userId, itemId, item.name, type, actualAmount, now, source);
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
    query(sql, params) {
        const db = this.getDatabase();
        const stmt = db.prepare(sql);
        return stmt.all(...(params || []));
    }
    execute(sql, params) {
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
    transaction(fn) {
        const db = this.getDatabase();
        return db.transaction(fn)();
    }
    async getProductByBarcode(barcode, maxAgeDays) {
        const db = this.getDatabase();
        if (maxAgeDays !== undefined) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
            const cutoffIso = cutoffDate.toISOString();
            const stmt = db.prepare(`SELECT * FROM product_cache 
         WHERE barcode = ? AND info_last_synced >= ?`);
            const row = stmt.get(barcode, cutoffIso);
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
        const stmt = db.prepare('SELECT * FROM product_cache WHERE barcode = ?');
        const row = stmt.get(barcode);
        if (!row)
            return null;
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
    async saveProduct(input) {
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
        stmt.run(input.barcode, input.name, input.brand || null, input.category, input.imageUrl || null, input.ingredients || null, input.nutrition ? JSON.stringify(input.nutrition) : null, input.source, now, now);
    }
    async saveClientError(error) {
        const db = this.getDatabase();
        const id = (0, uuid_1.v4)();
        const stmt = db.prepare(`
      INSERT INTO client_errors (id, user_id, error_type, error_message, error_stack, component, url, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, error.userId || null, error.errorType, error.errorMessage, error.errorStack || null, error.component || null, error.url || null, error.userAgent || null);
        return { id };
    }
    async getClientErrors(filters) {
        const db = this.getDatabase();
        const limit = filters.limit || 50;
        let query = 'SELECT * FROM client_errors WHERE 1=1';
        const params = [];
        if (filters.resolved !== undefined) {
            query += ' AND resolved = ?';
            params.push(filters.resolved ? 1 : 0);
        }
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    async markErrorResolved(id) {
        const db = this.getDatabase();
        const stmt = db.prepare('UPDATE client_errors SET resolved = 1 WHERE id = ?');
        stmt.run(id);
    }
}
exports.SQLiteAdapter = SQLiteAdapter;
//# sourceMappingURL=sqlite.js.map