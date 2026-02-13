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
//# sourceMappingURL=validation.d.ts.map