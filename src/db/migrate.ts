/**
 * Database migration system
 * Runs all migrations in sequence and tracks which ones have been applied
 * 
 * Supports both SQLite and PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { migrateExistingUsersToFreeTier } from '../services/subscription';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';
const DB_PATH = process.env.DB_PATH || './data/pantry.db';

// PostgreSQL config
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'pantry_pal';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_SSL = process.env.DB_SSL === 'true';

// ==========================================================================
// SQLite Migrations
// ==========================================================================

/**
 * Initialize migrations table (SQLite)
 */
function initMigrationsTableSQLite(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Get list of applied migrations (SQLite)
 */
function getAppliedMigrationsSQLite(db: Database.Database): string[] {
  const stmt = db.prepare('SELECT filename FROM migrations ORDER BY id');
  const rows = stmt.all() as { filename: string }[];
  return rows.map((r) => r.filename);
}

/**
 * Record a migration as applied (SQLite)
 */
function recordMigrationSQLite(db: Database.Database, filename: string): void {
  const stmt = db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)');
  stmt.run(filename, new Date().toISOString());
}

/**
 * Run a single migration file (SQLite)
 */
function runMigrationSQLite(db: Database.Database, filepath: string): void {
  const sql = fs.readFileSync(filepath, 'utf-8');
  db.exec(sql);
}

// ==========================================================================
// PostgreSQL Migrations
// ==========================================================================

async function getAppliedMigrationsPostgres(pool: Pool): Promise<string[]> {
  // Ensure migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map((r) => r.filename);
}

async function recordMigrationPostgres(pool: Pool, filename: string): Promise<void> {
  await pool.query(
    'INSERT INTO migrations (filename, applied_at) VALUES ($1, $2)',
    [filename, new Date().toISOString()]
  );
}

async function runMigrationPostgres(pool: Pool, filepath: string): Promise<void> {
  const sql = fs.readFileSync(filepath, 'utf-8');
  await pool.query(sql);
}

// ==========================================================================
// Migration Runner
// ==========================================================================

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
export async function runMigrationsSQLite(dbPath: string = DB_PATH): Promise<void> {
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
    initMigrationsTableSQLite(db);

    // Get applied migrations
    const applied = getAppliedMigrationsSQLite(db);

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
      runMigrationSQLite(db, filepath);
      recordMigrationSQLite(db, filename);
      console.log(`[MIGRATION] Applied ${filename}`);
    }

    console.log('[MIGRATION] All migrations completed successfully');
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

export async function runMigrationsPostgres(): Promise<void> {
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  });

  try {
    // Get applied migrations
    const applied = await getAppliedMigrationsPostgres(pool);

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
      await runMigrationPostgres(pool, filepath);
      await recordMigrationPostgres(pool, filename);
      console.log(`[MIGRATION] Applied ${filename}`);
    }

    console.log('[MIGRATION] All migrations completed successfully');
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Run migrations based on database type
 */
export function runMigrations(dbPath?: string): void | Promise<void> {
  if (DB_TYPE === 'postgres') {
    return runMigrationsPostgres();
  }
  return runMigrationsSQLite(dbPath || DB_PATH);
}

/**
 * CLI entry point for running migrations
 */
if (require.main === module) {
  console.log('[MIGRATION] Starting...');
  const result = runMigrations();
  if (result instanceof Promise) {
    result
      .then(() => {
        console.log('[MIGRATION] Done');
        process.exit(0);
      })
      .catch((err) => {
        console.error('[MIGRATION] Failed:', err);
        process.exit(1);
      });
  } else {
    console.log('[MIGRATION] Done');
    process.exit(0);
  }
}
