/**
 * Zod validation schemas for runtime request validation
 * Ensures type safety and data integrity at runtime
 */

import { z } from 'zod';
import { ActivityType, ActivitySource } from './types';

// ============================================================================
// Validation Constants
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEM_NAME_LENGTH = 100;
const MAX_UNIT_LENGTH = 20;
const MAX_CATEGORY_LENGTH = 50;

// ============================================================================
// Pantry Item Validation
// ============================================================================

export const createItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(MAX_ITEM_NAME_LENGTH, `Item name must be less than ${MAX_ITEM_NAME_LENGTH} characters`)
    .trim(),
  quantity: z
    .number()
    .min(0, 'Quantity must be non-negative')
    .max(999999, 'Quantity exceeds maximum allowed value'),
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
    .trim(),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
    .trim(),
});

export const updateItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name cannot be empty')
    .max(MAX_ITEM_NAME_LENGTH, `Item name must be less than ${MAX_ITEM_NAME_LENGTH} characters`)
    .trim()
    .optional(),
  quantity: z
    .number()
    .min(0, 'Quantity must be non-negative')
    .max(999999, 'Quantity exceeds maximum allowed value')
    .optional(),
  unit: z
    .string()
    .min(1, 'Unit cannot be empty')
    .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
    .trim()
    .optional(),
  category: z
    .string()
    .min(1, 'Category cannot be empty')
    .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
    .trim()
    .optional(),
});

export const itemIdSchema = z.object({
  id: z
    .string()
    .regex(UUID_REGEX, 'Invalid UUID format'),
});

// ============================================================================
// Activity Validation
// ============================================================================

const validActivityTypes: ActivityType[] = ['ADD', 'REMOVE', 'ADJUST'];
const validActivitySources: ActivitySource[] = ['MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE'];

export const createActivitySchema = z.object({
  itemId: z
    .string()
    .regex(UUID_REGEX, 'Invalid item ID format'),
  type: z
    .enum(['ADD', 'REMOVE', 'ADJUST'] as const)
    .refine((val): val is ActivityType => validActivityTypes.includes(val as ActivityType)),
  amount: z
    .number()
    .min(0.001, 'Amount must be greater than 0')
    .max(999999, 'Amount exceeds maximum allowed value'),
  source: z
    .enum(['MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE'] as const)
    .optional()
    .default('MANUAL')
    .refine((val): val is ActivitySource => validActivitySources.includes(val)),
});

// ============================================================================
// Scan & Usage Validation
// ============================================================================

export const scanResultSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(MAX_ITEM_NAME_LENGTH, `Name must be less than ${MAX_ITEM_NAME_LENGTH} characters`),
  quantity: z
    .number()
    .min(0, 'Quantity must be non-negative'),
  unit: z
    .string()
    .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
    .optional(),
  category: z
    .string()
    .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
    .optional(),
});

export const scanReceiptSchema = z.object({
  scanData: z.union([
    z.string().min(1, 'Scan data is required'),
    z.array(scanResultSchema).min(1, 'At least one item must be provided'),
  ]),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .optional(),
});

export const usageResultSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(MAX_ITEM_NAME_LENGTH, `Name must be less than ${MAX_ITEM_NAME_LENGTH} characters`),
  quantityUsed: z
    .number()
    .min(0.001, 'Quantity used must be greater than 0'),
});

export const visualUsageSchema = z.object({
  detections: z
    .array(usageResultSchema)
    .min(1, 'At least one detection is required'),
  detectionSource: z
    .string()
    .max(100)
    .optional(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type CreateItemValidated = z.infer<typeof createItemSchema>;
export type UpdateItemValidated = z.infer<typeof updateItemSchema>;

// Re-export ScanResult for backwards compatibility
export { ScanResult } from './types';
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ScanReceiptInput = z.infer<typeof scanReceiptSchema>;
export type VisualUsageInput = z.infer<typeof visualUsageSchema>;

// ============================================================================
// Pagination Validation
// ============================================================================

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
});

export type PaginationParams = z.infer<typeof paginationSchema>;