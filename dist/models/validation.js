"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.visualUsageSchema = exports.usageResultSchema = exports.scanReceiptSchema = exports.scanResultSchema = exports.createActivitySchema = exports.itemIdSchema = exports.updateItemSchema = exports.createItemSchema = void 0;
const zod_1 = require("zod");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEM_NAME_LENGTH = 100;
const MAX_UNIT_LENGTH = 20;
const MAX_CATEGORY_LENGTH = 50;
exports.createItemSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Item name is required')
        .max(MAX_ITEM_NAME_LENGTH, `Item name must be less than ${MAX_ITEM_NAME_LENGTH} characters`)
        .trim(),
    quantity: zod_1.z
        .number()
        .min(0, 'Quantity must be non-negative')
        .max(999999, 'Quantity exceeds maximum allowed value'),
    unit: zod_1.z
        .string()
        .min(1, 'Unit is required')
        .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
        .trim(),
    category: zod_1.z
        .string()
        .min(1, 'Category is required')
        .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
        .trim(),
});
exports.updateItemSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Item name cannot be empty')
        .max(MAX_ITEM_NAME_LENGTH, `Item name must be less than ${MAX_ITEM_NAME_LENGTH} characters`)
        .trim()
        .optional(),
    quantity: zod_1.z
        .number()
        .min(0, 'Quantity must be non-negative')
        .max(999999, 'Quantity exceeds maximum allowed value')
        .optional(),
    unit: zod_1.z
        .string()
        .min(1, 'Unit cannot be empty')
        .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
        .trim()
        .optional(),
    category: zod_1.z
        .string()
        .min(1, 'Category cannot be empty')
        .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
        .trim()
        .optional(),
});
exports.itemIdSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .regex(UUID_REGEX, 'Invalid UUID format'),
});
const validActivityTypes = ['ADD', 'REMOVE', 'ADJUST'];
const validActivitySources = ['MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE'];
exports.createActivitySchema = zod_1.z.object({
    itemId: zod_1.z
        .string()
        .regex(UUID_REGEX, 'Invalid item ID format'),
    type: zod_1.z
        .enum(['ADD', 'REMOVE', 'ADJUST'])
        .refine((val) => validActivityTypes.includes(val)),
    amount: zod_1.z
        .number()
        .min(0.001, 'Amount must be greater than 0')
        .max(999999, 'Amount exceeds maximum allowed value'),
    source: zod_1.z
        .enum(['MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE'])
        .optional()
        .default('MANUAL')
        .refine((val) => validActivitySources.includes(val)),
});
exports.scanResultSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Item name is required')
        .max(MAX_ITEM_NAME_LENGTH, `Name must be less than ${MAX_ITEM_NAME_LENGTH} characters`),
    quantity: zod_1.z
        .number()
        .min(0, 'Quantity must be non-negative'),
    unit: zod_1.z
        .string()
        .max(MAX_UNIT_LENGTH, `Unit must be less than ${MAX_UNIT_LENGTH} characters`)
        .optional(),
    category: zod_1.z
        .string()
        .max(MAX_CATEGORY_LENGTH, `Category must be less than ${MAX_CATEGORY_LENGTH} characters`)
        .optional(),
});
exports.scanReceiptSchema = zod_1.z.object({
    scanData: zod_1.z.union([
        zod_1.z.string().min(1, 'Scan data is required'),
        zod_1.z.array(exports.scanResultSchema).min(1, 'At least one item must be provided'),
    ]),
    minConfidence: zod_1.z
        .number()
        .min(0)
        .max(1)
        .optional(),
});
exports.usageResultSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, 'Item name is required')
        .max(MAX_ITEM_NAME_LENGTH, `Name must be less than ${MAX_ITEM_NAME_LENGTH} characters`),
    quantityUsed: zod_1.z
        .number()
        .min(0.001, 'Quantity used must be greater than 0'),
});
exports.visualUsageSchema = zod_1.z.object({
    detections: zod_1.z
        .array(exports.usageResultSchema)
        .min(1, 'At least one detection is required'),
    detectionSource: zod_1.z
        .string()
        .max(100)
        .optional(),
});
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(zod_1.z.number().min(1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 20))
        .pipe(zod_1.z.number().min(1).max(100)),
});
//# sourceMappingURL=validation.js.map