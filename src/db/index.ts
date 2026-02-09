/**
 * Database factory and exports
 * Supports both SQLite and PostgreSQL via environment variable
 */

import { DatabaseAdapter } from './adapter';
import { SQLiteAdapter } from './sqlite';
import { PostgresAdapter } from './postgres';

// Database type from environment
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

/**
 * Get the appropriate database adapter based on environment
 */
export function getAdapter(): DatabaseAdapter {
  if (DB_TYPE === 'postgres') {
    return new PostgresAdapter();
  }
  return new SQLiteAdapter();
}

/**
 * Singleton adapter instance
 */
let adapter: DatabaseAdapter | null = null;

/**
 * Get or create the database adapter (singleton pattern)
 */
export function getDatabase(): DatabaseAdapter {
  if (!adapter) {
    adapter = getAdapter();
    adapter.initialize();
  }
  return adapter;
}

/**
 * Close database connection
 * Call this for graceful shutdown
 */
export function closeDatabase(): void {
  if (adapter) {
    adapter.close();
    adapter = null;
  }
}

// Re-export types
export type { DatabaseAdapter } from './adapter';
export type {
  PantryItem,
  Activity,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
} from '../models/types';
export type {
  CreateItemInput,
  UpdateItemInput,
} from './adapter';
