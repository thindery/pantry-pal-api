import { z } from 'zod';
import { ActivityType, ActivitySource } from './types';
export declare const createItemSchema: z.ZodObject<{
    name: z.ZodString;
    barcode: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    category: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity: number;
    unit: string;
    category: string;
    barcode?: string | undefined;
}, {
    name: string;
    quantity: number;
    unit: string;
    category: string;
    barcode?: string | undefined;
}>;
export declare const updateItemSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
    quantity: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    barcode?: string | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    category?: string | undefined;
}, {
    name?: string | undefined;
    barcode?: string | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    category?: string | undefined;
}>;
export declare const itemIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const createActivitySchema: z.ZodObject<{
    itemId: z.ZodString;
    type: z.ZodEffects<z.ZodEnum<["ADD", "REMOVE", "ADJUST"]>, ActivityType, "ADD" | "REMOVE" | "ADJUST">;
    amount: z.ZodNumber;
    source: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodEnum<["MANUAL", "RECEIPT_SCAN", "VISUAL_USAGE"]>>>, ActivitySource, "MANUAL" | "RECEIPT_SCAN" | "VISUAL_USAGE" | undefined>;
}, "strip", z.ZodTypeAny, {
    source: ActivitySource;
    itemId: string;
    type: ActivityType;
    amount: number;
}, {
    itemId: string;
    type: "ADD" | "REMOVE" | "ADJUST";
    amount: number;
    source?: "MANUAL" | "RECEIPT_SCAN" | "VISUAL_USAGE" | undefined;
}>;
export declare const scanResultSchema: z.ZodObject<{
    name: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity: number;
    unit?: string | undefined;
    category?: string | undefined;
}, {
    name: string;
    quantity: number;
    unit?: string | undefined;
    category?: string | undefined;
}>;
export declare const scanReceiptSchema: z.ZodObject<{
    scanData: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        unit?: string | undefined;
        category?: string | undefined;
    }, {
        name: string;
        quantity: number;
        unit?: string | undefined;
        category?: string | undefined;
    }>, "many">]>;
    minConfidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    scanData: string | {
        name: string;
        quantity: number;
        unit?: string | undefined;
        category?: string | undefined;
    }[];
    minConfidence?: number | undefined;
}, {
    scanData: string | {
        name: string;
        quantity: number;
        unit?: string | undefined;
        category?: string | undefined;
    }[];
    minConfidence?: number | undefined;
}>;
export declare const usageResultSchema: z.ZodObject<{
    name: z.ZodString;
    quantityUsed: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantityUsed: number;
}, {
    name: string;
    quantityUsed: number;
}>;
export declare const visualUsageSchema: z.ZodObject<{
    detections: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        quantityUsed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantityUsed: number;
    }, {
        name: string;
        quantityUsed: number;
    }>, "many">;
    detectionSource: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    detections: {
        name: string;
        quantityUsed: number;
    }[];
    detectionSource?: string | undefined;
}, {
    detections: {
        name: string;
        quantityUsed: number;
    }[];
    detectionSource?: string | undefined;
}>;
export type CreateItemValidated = z.infer<typeof createItemSchema>;
export type UpdateItemValidated = z.infer<typeof updateItemSchema>;
export { ScanResult } from './types';
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ScanReceiptInput = z.infer<typeof scanReceiptSchema>;
export type VisualUsageInput = z.infer<typeof visualUsageSchema>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, z.ZodNumber>;
    limit: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export declare const createSessionSchema: z.ZodObject<{
    storeName: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    storeName?: string | undefined;
    notes?: string | undefined;
}, {
    storeName?: string | undefined;
    notes?: string | undefined;
}>;
export declare const addSessionItemSchema: z.ZodObject<{
    barcode: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    unit: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity: number;
    barcode?: string | undefined;
    unit?: string | undefined;
    category?: string | undefined;
    price?: number | undefined;
}, {
    name: string;
    barcode?: string | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    category?: string | undefined;
    price?: number | undefined;
}>;
export declare const completeSessionSchema: z.ZodObject<{
    receiptUrl: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    receiptUrl?: string | undefined;
}, {
    notes?: string | undefined;
    receiptUrl?: string | undefined;
}>;
export declare const sessionIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const sessionItemIdSchema: z.ZodObject<{
    itemId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    itemId: string;
}, {
    itemId: string;
}>;
export declare const updateSessionSchema: z.ZodObject<{
    storeName: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        barcode: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        quantity: z.ZodOptional<z.ZodNumber>;
        unit: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
        category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id?: string | undefined;
        barcode?: string | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        category?: string | undefined;
        price?: number | undefined;
    }, {
        name: string;
        id?: string | undefined;
        barcode?: string | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        category?: string | undefined;
        price?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    storeName?: string | undefined;
    notes?: string | undefined;
    items?: {
        name: string;
        id?: string | undefined;
        barcode?: string | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        category?: string | undefined;
        price?: number | undefined;
    }[] | undefined;
}, {
    storeName?: string | undefined;
    notes?: string | undefined;
    items?: {
        name: string;
        id?: string | undefined;
        barcode?: string | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        category?: string | undefined;
        price?: number | undefined;
    }[] | undefined;
}>;
export declare const captureReceiptSchema: z.ZodObject<{
    imageData: z.ZodString;
    mimeType: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imageData: string;
    mimeType: string;
    notes?: string | undefined;
}, {
    imageData: string;
    mimeType: string;
    notes?: string | undefined;
}>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type AddSessionItemInput = z.infer<typeof addSessionItemSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CaptureReceiptInput = z.infer<typeof captureReceiptSchema>;
//# sourceMappingURL=validation.d.ts.map