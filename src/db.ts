/**
 * Database layer - compatibility shim
 * Re-exports from the new db/index.ts for backward compatibility
 * 
 * NOTE: This file is kept for backward compatibility.
 * New code should import from './db/index' directly.
 */

// Re-export everything from the new db module
export {
  getDatabase,
  closeDatabase,
  DatabaseAdapter,
  CreateItemInput,
  UpdateItemInput,
} from './db/index';

// Also export the old db operations directly for backward compatibility
// These are now async and will work with both SQLite and PostgreSQL
export {
  getAllItems,
  getItemById,
  getItemByName,
  createItem,
  updateItem,
  deleteItem,
  adjustItemQuantity,
  getCategories,
} from './db/operations';

export {
  getActivities,
  getActivityCount,
  logActivity,
} from './db/operations';

export {
  processReceiptScan,
  processVisualUsage,
} from './db/operations';

// For backward compatibility with old code that imported from db.ts
// We need to make these operations available but they now delegate
// to the adapter pattern internally
