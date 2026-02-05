/**
 * Core type definitions for the Pantry Tracker API
 * Designed for scalability and type safety across the application
 */

// ============================================================================
// Activity Types
// ============================================================================

export type ActivityType = 'ADD' | 'REMOVE' | 'ADJUST';

export type ActivitySource = 'MANUAL' | 'RECEIPT_SCAN' | 'VISUAL_USAGE';

// ============================================================================
// Pantry Item Model
// ============================================================================

/**
 * Represents an item stored in the pantry
 * Tracks current inventory levels and categorization
 */
export interface PantryItem {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name of the item */
  name: string;
  /** Current quantity in stock */
  quantity: number;
  /** Unit of measurement (e.g., 'lbs', 'cups', 'pieces') */
  unit: string;
  /** Category for organization (e.g., 'produce', 'pantry', 'dairy') */
  category: string;
  /** ISO 8601 timestamp of last update */
  lastUpdated: string;
  /** User ID who owns this item */
  userId: string;
  /** Optional barcode for the item */
  barcode?: string;
}

/**
 * Database schema representation for pantry_items table
 */
export interface PantryItemRow {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  last_updated: string;
  user_id: string;
}

// ============================================================================
// Activity Model
// ============================================================================

/**
 * Represents a change activity logged for audit trail
 * Tracks additions, removals, and adjustments to inventory
 */
export interface Activity {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to the affected pantry item */
  itemId: string;
  /** Denormalized item name for quick reference */
  itemName: string;
  /** Type of activity performed */
  type: ActivityType;
  /** Quantity amount changed (positive for ADD, negative for REMOVE) */
  amount: number;
  /** ISO 8601 timestamp when activity occurred */
  timestamp: string;
  /** Source of the activity entry */
  source: ActivitySource;
  /** User ID who performed this activity */
  userId: string;
}

/**
 * Database schema representation for activities table
 */
export interface ActivityRow {
  id: string;
  item_id: string;
  item_name: string;
  type: ActivityType;
  amount: number;
  timestamp: string;
  source: ActivitySource;
  user_id: string;
}

// ============================================================================
// Scan & Detection Results
// ============================================================================

/**
 * Result from receipt scanning - extracted item information
 * Used for bulk importing items from shopping receipts
 */
export interface ScanResult {
  /** Detected item name */
  name: string;
  /** Detected quantity */
  quantity: number;
  /** Detected unit (optional - may be inferred) */
  unit?: string;
  /** Suggested category (optional - may be classified) */
  category?: string;
}

/**
 * Result from visual usage detection - AI-powered consumption tracking
 * Used when camera/vision system detects item usage
 */
export interface UsageResult {
  /** Detected item name */
  name: string;
  /** Estimated quantity used */
  quantityUsed: number;
}

/**
 * Request body for creating a new pantry item
 * Alias for use in database layer
 */
export type CreateItemInput = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
};

/**
 * Request body for updating an existing pantry item
 * Alias for use in database layer
 */
export type UpdateItemInput = {
  name?: string;
  quantity?: number;
  unit?: string;
  category?: string;
};

/**
 * Request body for creating a new pantry item (API variant)
 */
export interface CreateItemRequest {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

/**
 * Request body for updating an existing pantry item (API variant)
 */
export interface UpdateItemRequest {
  name?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

/**
 * Request body for logging a new activity
 */
export interface CreateActivityRequest {
  itemId: string;
  type: ActivityType;
  amount: number;
  source?: ActivitySource;
}

/**
 * Request body for receipt scanning endpoint
 * Accepts raw scan data from OCR/ML service
 */
export interface ScanReceiptRequest {
  /** Raw text or structured data from receipt scan */
  scanData: string | ScanResult[];
  /** Optional: confidence threshold for filtering */
  minConfidence?: number;
}

/**
 * Request body for visual usage detection endpoint
 * Accepts detection results from computer vision system
 */
export interface VisualUsageRequest {
  /** Detected usage items from vision system */
  detections: UsageResult[];
  /** Optional: session/camera identifier */
  detectionSource?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  total?: number;
  page?: number;
  limit?: number;
  timestamp: string;
}

// ============================================================================
// Database Types
// ============================================================================

export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
}

// ============================================================================
// Validation Schemas (using Zod)
// ============================================================================

// Note: Zod schemas are defined in validation.ts for runtime validation
// These types are for TypeScript compile-time checking
