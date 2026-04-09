/**
 * Shopping Session Types
 * Type definitions for shopping session functionality
 * Ticket: REMY-285
 */

// ============================================================================
// Session Status
// ============================================================================

export type ShoppingSessionStatus = 'active' | 'completed' | 'cancelled';

// ============================================================================
// Shopping Session Models
// ============================================================================

/**
 * Represents a shopping session (cart/receipt scanner mode)
 */
export interface ShoppingSession {
  /** Unique identifier (UUID) */
  id: string;
  /** User ID who owns this session */
  userId: string;
  /** Optional store name where shopping occurred */
  storeName?: string;
  /** ISO 8601 timestamp when session started */
  startedAt: string;
  /** ISO 8601 timestamp when session completed (null if active) */
  completedAt?: string;
  /** Current session status */
  status: ShoppingSessionStatus;
  /** Running total of all items in session */
  totalAmount: number;
  /** Number of items in session */
  itemCount: number;
  /** Optional URL to saved receipt image */
  receiptUrl?: string;
  /** Optional notes about the session */
  notes?: string;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Database schema representation for shopping_sessions table
 */
export interface ShoppingSessionRow {
  id: string;
  user_id: string;
  store_name: string | null;
  started_at: string;
  completed_at: string | null;
  status: ShoppingSessionStatus;
  total_amount: number;
  item_count: number;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Session Item Models
// ============================================================================

/**
 * Represents an item in a shopping session
 * Similar to ScanResult but with price and linked to session
 */
export interface SessionItem {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to parent shopping session */
  sessionId: string;
  /** Optional barcode for the item */
  barcode?: string;
  /** Display name of the item */
  name: string;
  /** Quantity purchased */
  quantity: number;
  /** Unit of measurement */
  unit?: string;
  /** Price per unit or total price (depending on usage) */
  price?: number;
  /** Category for organization */
  category?: string;
  /** ISO 8601 timestamp when item was added */
  addedAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Database schema representation for session_items table
 */
export interface SessionItemRow {
  id: string;
  session_id: string;
  barcode: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  category: string | null;
  added_at: string;
  updated_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request body for creating a new shopping session
 */
export interface CreateSessionRequest {
  /** Optional store name */
  storeName?: string;
  /** Optional notes */
  notes?: string;
}

/**
 * Request body for adding an item to a session
 */
export interface AddSessionItemRequest {
  /** Optional barcode */
  barcode?: string;
  /** Item name (required) */
  name: string;
  /** Quantity (defaults to 1) */
  quantity?: number;
  /** Unit of measurement */
  unit?: string;
  /** Price (optional for running total) */
  price?: number;
  /** Category */
  category?: string;
}

/**
 * Request body for completing a session
 */
export interface CompleteSessionRequest {
  /** Optional receipt image URL */
  receiptUrl?: string;
  /** Final notes */
  notes?: string;
}

/**
 * Response when retrieving a session with items
 */
export interface ShoppingSessionWithItems extends ShoppingSession {
  /** All items in the session */
  items: SessionItem[];
}

/**
 * Session list item (lightweight for listing)
 */
export interface ShoppingSessionListItem {
  id: string;
  storeName?: string;
  startedAt: string;
  completedAt?: string;
  status: ShoppingSessionStatus;
  totalAmount: number;
  itemCount: number;
}

/**
 * Session summary statistics
 */
export interface SessionSummary {
  totalSessions: number;
  totalSpent: number;
  averageSessionValue: number;
}
