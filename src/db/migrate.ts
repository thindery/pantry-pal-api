/**
 * Database migration system
 * Runs all migrations in sequence and tracks which ones have been applied
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initializeSubscriptionSchema, migrateExistingUsersToFreeTier } from '../services/subscription';

const DB_PATH = process.env.DB_PATH || './data/pantry.db';

// Note: Migration metadata type
// interface Migration { id: number; filename: string; appliedAt: string; }

/**
 * Initialize migrations table
 */
function initMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(db: Database.Database): string[] {
  const stmt = db.prepare('SELECT filename FROM migrations ORDER BY id');
  const rows = stmt.all() as { filename: string }[];
  return rows.map((r) => r.filename);
}

/**
 * Record a migration as applied
 */
function recordMigration(db: Database.Database, filename: string): void {
  const stmt = db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)');
  stmt.run(filename, new Date().toISOString());
}

/**
 * Run a single migration file
 */
function runMigration(db: Database.Database, filepath: string): void {
  const sql = fs.readFileSync(filepath, 'utf-8');
  db.exec(sql);
}

/**
 * Get migration files from directory
 */
function getMigrationFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Run all pending migrations
 */
export function runMigrations(dbPath: string = DB_PATH): void {
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Initialize migrations table
    initMigrationsTable(db);

    // Get applied migrations
    const applied = getAppliedMigrations(db);

    // Run pending SQL migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = getMigrationFiles(migrationsDir);

    for (const filename of migrationFiles) {
      if (applied.includes(filename)) {
        console.log(`[MIGRATION] Skipping ${filename} (already applied)`);
        continue;
      }

      console.log(`[MIGRATION] Applying ${filename}...`);
      const filepath = path.join(migrationsDir, filename);
      runMigration(db, filepath);
      recordMigration(db, filename);
      console.log(`[MIGRATION] Applied ${filename}`);
    }

    // Run TypeScript-based migrations
    console.log('[MIGRATION] Running TypeScript migrations...');

    // Initialize subscription schema
    initializeSubscriptionSchema(db);

    // Migrate existing users to free tier
    migrateExistingUsersToFreeTier();

    console.log('[MIGRATION] All migrations completed successfully');
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * CLI entry point for running migrations
 */
if (require.main === module) {
  console.log('[MIGRATION] Starting...');
  runMigrations();
  console.log('[MIGRATION] Done');
  process.exit(0);
}
