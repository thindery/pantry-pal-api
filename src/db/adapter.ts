/**
 * Database Adapter Interface
 * Abstracts database operations to support multiple backends (SQLite, PostgreSQL)
 */

import {
  PantryItem,
  Activity,
  ActivityType,
  ActivitySource,
  ScanResult,
  UsageResult,
} from '../models/types';

/**
 * Input type for creating a new pantry item
 */
export interface CreateItemInput {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  barcode?: string;
}

/**
 * Input type for updating an existing pantry item
 */
export interface UpdateItemInput {
  name?: string;
  barcode?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

/**
 * Database Adapter Interface
 * All database implementations must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Initialize the database connection and schema
   */
  initialize(): void;

  /**
   * Close the database connection
   */
  close(): void;

  // ==========================================================================
  // Pantry Item Operations
  // ==========================================================================

  /**
   * Get all pantry items for a user with optional filtering
   */
  getAllItems(userId: string, category?: string): Promise<PantryItem[]>;

  /**
   * Get a single pantry item by ID (for a specific user)
   */
  getItemById(userId: string, id: string): Promise<PantryItem | null>;

  /**
   * Get a pantry item by name (case-insensitive) for a specific user
   */
  getItemByName(userId: string, name: string): Promise<PantryItem | null>;

  /**
   * Create a new pantry item for a user
   */
  createItem(userId: string, input: CreateItemInput): Promise<PantryItem>;

  /**
   * Update an existing pantry item for a user
   * Returns null if item not found
   */
  updateItem(userId: string, id: string, input: UpdateItemInput): Promise<PantryItem | null>;

  /**
   * Delete a pantry item by ID for a user
   * Returns true if deleted, false if not found
   */
  deleteItem(userId: string, id: string): Promise<boolean>;

  /**
   * Adjust item quantity directly for a user (used by activity logging)
   */
  adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null>;

  /**
   * Get all unique categories for a user
   */
  getCategories(userId: string): Promise<string[]>;

  // ==========================================================================
  // Activity Operations
  // ==========================================================================

  /**
   * Get all activities for a user with pagination
   */
  getActivities(
    userId: string,
    limit?: number,
    offset?: number,
    itemId?: string
  ): Promise<Activity[]>;

  /**
   * Get total count of activities for a user (for pagination)
   */
  getActivityCount(userId: string, itemId?: string): Promise<number>;

  /**
   * Log a new activity for a user and update item quantity
   * This is a transaction to ensure data consistency
   */
  logActivity(
    userId: string,
    itemId: string,
    type: ActivityType,
    amount: number,
    source?: ActivitySource
  ): Promise<Activity | null>;

  // ==========================================================================
  // Scan Receipt Operations
  // ==========================================================================

  /**
   * Process receipt scan data and return standardized scan results
   * In production, this would integrate with OCR/ML services
   */
  processReceiptScan(rawData: string | ScanResult[]): ScanResult[];

  // ==========================================================================
  // Visual Usage Operations
  // ==========================================================================

  /**
   * Process visual usage detection results for a user
   * Creates REMOVE activities for detected usage
   */
  processVisualUsage(
    userId: string,
    detections: UsageResult[],
    source?: string
  ): Promise<{ processed: UsageResult[]; activities: Activity[]; errors: string[] }>;

  // ==========================================================================
  // Raw Query Access (for subscription service)
  // ==========================================================================

  /**
   * Execute a raw query (for subscription service compatibility)
   * Returns appropriate result based on query type
   */
  query(sql: string, params?: unknown[]): Promise<unknown[]> | unknown[];

  /**
   * Execute a raw command (INSERT, UPDATE, DELETE)
   * Returns the number of affected rows
   */
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastID?: string | number }>;

  /**
   * Execute within a transaction
   */
  transaction<T>(fn: () => T): Promise<T> | T;
}
