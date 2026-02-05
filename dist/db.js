"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbExports = void 0;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.getAllItems = getAllItems;
exports.getItemById = getItemById;
exports.getItemByName = getItemByName;
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.adjustItemQuantity = adjustItemQuantity;
exports.getCategories = getCategories;
exports.getActivities = getActivities;
exports.getActivityCount = getActivityCount;
exports.logActivity = logActivity;
exports.processReceiptScan = processReceiptScan;
exports.processVisualUsage = processVisualUsage;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const uuid_1 = require("uuid");
const migrate_1 = require("./db/migrate");
const subscription_1 = require("./services/subscription");
const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const isDevelopment = process.env.NODE_ENV !== 'production';
let db = null;
function getDatabase() {
    if (!db) {
        (0, migrate_1.runMigrations)(DB_PATH);
        db = new better_sqlite3_1.default(DB_PATH, {
            verbose: isDevelopment ? console.log : undefined,
        });
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeSchema();
        (0, subscription_1.initializeSubscriptionSchema)(db);
    }
    return db;
}
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
function initializeSchema() {
    if (!db)
        throw new Error('Database not initialized');
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
    CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_name ON pantry_items(name);
    CREATE INDEX IF NOT EXISTS idx_pantry_items_barcode ON pantry_items(barcode);
    CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_item_id ON activities(item_id);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
  `);
    console.log('[DB] Schema initialized successfully');
}
function mapPantryItemRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        barcode: row.barcode,
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
function getAllItems(userId, category) {
    const database = getDatabase();
    let query = 'SELECT * FROM pantry_items WHERE user_id = ?';
    const params = [userId];
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    query += ' ORDER BY name COLLATE NOCASE';
    const stmt = database.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(mapPantryItemRow);
}
function getItemById(userId, id) {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND id = ?');
    const row = stmt.get(userId, id);
    return row ? mapPantryItemRow(row) : null;
}
function getItemByName(userId, name) {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM pantry_items WHERE user_id = ? AND LOWER(name) = LOWER(?)');
    const row = stmt.get(userId, name);
    return row ? mapPantryItemRow(row) : null;
}
function createItem(userId, input) {
    const database = getDatabase();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const stmt = database.prepare(`
    INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, userId, input.name, input.barcode || null, input.quantity, input.unit, input.category, now);
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
function updateItem(userId, id, input) {
    const database = getDatabase();
    const existing = getItemById(userId, id);
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
    const stmt = database.prepare(query);
    stmt.run(...params);
    return getItemById(userId, id);
}
function deleteItem(userId, id) {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM pantry_items WHERE user_id = ? AND id = ?');
    const result = stmt.run(userId, id);
    return result.changes > 0;
}
function adjustItemQuantity(userId, id, adjustment) {
    const database = getDatabase();
    const existing = getItemById(userId, id);
    if (!existing)
        return null;
    const newQuantity = Math.max(0, existing.quantity + adjustment);
    const now = new Date().toISOString();
    const stmt = database.prepare(`
    UPDATE pantry_items 
    SET quantity = ?, last_updated = ? 
    WHERE user_id = ? AND id = ?
  `);
    stmt.run(newQuantity, now, userId, id);
    return getItemById(userId, id);
}
function getCategories(userId) {
    const database = getDatabase();
    const stmt = database.prepare('SELECT DISTINCT category FROM pantry_items WHERE user_id = ? ORDER BY category COLLATE NOCASE');
    const rows = stmt.all(userId);
    return rows.map((r) => r.category);
}
function getActivities(userId, limit = 20, offset = 0, itemId) {
    const database = getDatabase();
    let query = 'SELECT * FROM activities WHERE user_id = ?';
    const params = [userId];
    if (itemId) {
        query += ' AND item_id = ?';
        params.push(itemId);
    }
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const stmt = database.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(mapActivityRow);
}
function getActivityCount(userId, itemId) {
    const database = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = ?';
    const params = [userId];
    if (itemId) {
        query += ' AND item_id = ?';
        params.push(itemId);
    }
    const stmt = database.prepare(query);
    const result = stmt.get(...params);
    return result.count;
}
function logActivity(userId, itemId, type, amount, source = 'MANUAL') {
    const database = getDatabase();
    const item = getItemById(userId, itemId);
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
    const transaction = database.transaction(() => {
        const activityStmt = database.prepare(`
      INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        activityStmt.run(id, userId, itemId, item.name, type, actualAmount, now, source);
        const newQuantity = Math.max(0, item.quantity + quantityAdjustment);
        const updateStmt = database.prepare(`
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
function processReceiptScan(rawData) {
    if (Array.isArray(rawData)) {
        return rawData.filter((item) => item.name && item.quantity >= 0);
    }
    return parseReceiptText(rawData);
}
function parseReceiptText(text) {
    const lines = text.split('\n').filter((line) => line.trim());
    const results = [];
    for (const line of lines) {
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
function inferCategory(name) {
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
function processVisualUsage(userId, detections, source = 'VISUAL_USAGE') {
    const results = {
        processed: [],
        activities: [],
        errors: [],
    };
    for (const detection of detections) {
        const item = getItemByName(userId, detection.name);
        if (!item) {
            results.errors.push(`Item not found: ${detection.name}`);
            continue;
        }
        const activity = logActivity(userId, item.id, 'REMOVE', detection.quantityUsed, source);
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
exports.dbExports = {
    initializeSchema,
    parseReceiptText,
    inferCategory,
};
//# sourceMappingURL=db.js.map