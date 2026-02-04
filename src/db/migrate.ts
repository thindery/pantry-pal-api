/**
 * Database Migration Script
 * Handles schema migrations for the Pantry Pal API
 * Run with: npm run db:migrate
 *
 * This script handles migrations from older schema versions to current.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const DB_PATH = process.env.DB_PATH || './data/pantry.db';
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'legacy_user_001';

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Check if a column exists in a table
 */
function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  const columns = stmt.all() as Array<{ name: string }>;
  return columns.some((col) => col.name === columnName);
}

/**
 * Check if an index exists
 */
function indexExists(db: Database.Database, indexName: string): boolean {
  const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?");
  const result = stmt.get(indexName) as { name: string } | undefined;
  return !!result;
}

/**
 * Migration: Add user_id column to pantry_items table
 */
function migratePantryItemsUserId(db: Database.Database): void {
  if (columnExists(db, 'pantry_items', 'user_id')) {
    console.log('[MIGRATE] pantry_items.user_id already exists, skipping...');
    return;
  }

  console.log('[MIGRATE] Adding user_id column to pantry_items...');

  // SQLite doesn't support ALTER TABLE ADD COLUMN with NOT NULL without DEFAULT
  // So we add it without NOT NULL first, populate it, then add the constraint
  db.exec(`
    ALTER TABLE pantry_items ADD COLUMN user_id TEXT;
  `);

  // Update existing records with default user_id
  const updateStmt = db.prepare('UPDATE pantry_items SET user_id = ? WHERE user_id IS NULL');
  const result = updateStmt.run(DEFAULT_USER_ID);
  console.log(`[MIGRATE] Updated ${result.changes} existing pantry_items with default user_id`);

  // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we can't add NOT NULL after
  // The app will enforce this, but we should document this limitation
  console.log('[MIGRATE] Note: NOT NULL constraint cannot be added to existing SQLite column');
  console.log('[MIGRATE] The application will enforce user_id requirement');
}

/**
 * Migration: Add user_id column to activities table
 */
function migrateActivitiesUserId(db: Database.Database): void {
  if (columnExists(db, 'activities', 'user_id')) {
    console.log('[MIGRATE] activities.user_id already exists, skipping...');
    return;
  }

  console.log('[MIGRATE] Adding user_id column to activities...');

  db.exec(`
    ALTER TABLE activities ADD COLUMN user_id TEXT;
  `);

  // Update existing records with default user_id
  const updateStmt = db.prepare('UPDATE activities SET user_id = ? WHERE user_id IS NULL');
  const result = updateStmt.run(DEFAULT_USER_ID);
  console.log(`[MIGRATE] Updated ${result.changes} existing activities with default user_id`);
}

/**
 * Migration: Add barcode column to pantry_items table
 */
function migratePantryItemsBarcode(db: Database.Database): void {
  if (columnExists(db, 'pantry_items', 'barcode')) {
    console.log('[MIGRATE] pantry_items.barcode already exists, skipping...');
    return;
  }

  console.log('[MIGRATE] Adding barcode column to pantry_items...');

  db.exec(`
    ALTER TABLE pantry_items ADD COLUMN barcode TEXT;
  `);

  console.log('[MIGRATE] Added barcode column to pantry_items');
}

/**
 * Migration: Add missing indexes
 */
function migrateIndexes(db: Database.Database): void {
  const indexesToAdd = [
    { name: 'idx_pantry_items_user_id', sql: 'CREATE INDEX idx_pantry_items_user_id ON pantry_items(user_id)' },
    { name: 'idx_activities_user_id', sql: 'CREATE INDEX idx_activities_user_id ON activities(user_id)' },
  ];

  for (const { name, sql } of indexesToAdd) {
    if (indexExists(db, name)) {
      console.log(`[MIGRATE] Index ${name} already exists, skipping...`);
      continue;
    }

    console.log(`[MIGRATE] Creating index ${name}...`);
    db.exec(sql);
  }

  // Barcode index only if barcode column exists
  if (columnExists(db, 'pantry_items', 'barcode')) {
    if (!indexExists(db, 'idx_pantry_items_barcode')) {
      console.log('[MIGRATE] Creating index idx_pantry_items_barcode...');
      db.exec('CREATE INDEX idx_pantry_items_barcode ON pantry_items(barcode)');
    } else {
      console.log('[MIGRATE] Index idx_pantry_items_barcode already exists, skipping...');
    }
  }
}

/**
 * Main migration function
 */
export function runMigrations(dbPath: string = DB_PATH): void {
  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open database
  const db = new Database(dbPath);
  console.log(`[MIGRATE] Connected to database: ${dbPath}`);

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Disable foreign keys temporarily for migrations that might affect constraints
    db.exec('PRAGMA foreign_keys = OFF;');

    console.log('[MIGRATE] Starting migrations...\n');

    // Run migrations
    migratePantryItemsUserId(db);
    migrateActivitiesUserId(db);
    migratePantryItemsBarcode(db);
    migrateIndexes(db);

    console.log('\n[MIGRATE] All migrations completed successfully');

    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON;');

    // Verify migrations
    console.log('\n[MIGRATE] Verifying migrations...');
    const verification = {
      pantryItemsHasUserId: columnExists(db, 'pantry_items', 'user_id'),
      activitiesHasUserId: columnExists(db, 'activities', 'user_id'),
      idxPantryUserId: indexExists(db, 'idx_pantry_items_user_id'),
      idxActivitiesUserId: indexExists(db, 'idx_activities_user_id'),
    };

    console.log('[MIGRATE] Verification results:');
    console.log(`  - pantry_items.user_id: ${verification.pantryItemsHasUserId ? '✓' : '✗'}`);
    console.log(`  - activities.user_id: ${verification.activitiesHasUserId ? '✓' : '✗'}`);
    console.log(`  - idx_pantry_items_user_id: ${verification.idxPantryUserId ? '✓' : '✗'}`);
    console.log(`  - idx_activities_user_id: ${verification.idxActivitiesUserId ? '✓' : '✗'}`);

    const allPassed = Object.values(verification).every(Boolean);
    if (!allPassed) {
      throw new Error('Migration verification failed!');
    }

    console.log('\n[MIGRATE] ✓ Database is ready!');
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// ============================================================================
// CLI Execution
// ============================================================================

if (require.main === module) {
  try {
    runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
