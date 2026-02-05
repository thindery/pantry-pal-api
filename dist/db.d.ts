import Database from 'better-sqlite3';
import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult } from './models/types';
export declare function getDatabase(): Database.Database;
export declare function closeDatabase(): void;
declare function initializeSchema(): void;
export declare function getAllItems(userId: string, category?: string): PantryItem[];
export declare function getItemById(userId: string, id: string): PantryItem | null;
export declare function getItemByName(userId: string, name: string): PantryItem | null;
export interface CreateItemInput {
    name: string;
    quantity: number;
    unit: string;
    category: string;
    barcode?: string;
}
export interface UpdateItemInput {
    name?: string;
    barcode?: string;
    quantity?: number;
    unit?: string;
    category?: string;
}
export declare function createItem(userId: string, input: CreateItemInput): PantryItem;
export declare function updateItem(userId: string, id: string, input: UpdateItemInput): PantryItem | null;
export declare function deleteItem(userId: string, id: string): boolean;
export declare function adjustItemQuantity(userId: string, id: string, adjustment: number): PantryItem | null;
export declare function getCategories(userId: string): string[];
export declare function getActivities(userId: string, limit?: number, offset?: number, itemId?: string): Activity[];
export declare function getActivityCount(userId: string, itemId?: string): number;
export declare function logActivity(userId: string, itemId: string, type: ActivityType, amount: number, source?: ActivitySource): Activity | null;
export declare function processReceiptScan(rawData: string | ScanResult[]): ScanResult[];
declare function parseReceiptText(text: string): ScanResult[];
declare function inferCategory(name: string): string;
export declare function processVisualUsage(userId: string, detections: UsageResult[], source?: string): {
    processed: UsageResult[];
    activities: Activity[];
    errors: string[];
};
export declare const dbExports: {
    initializeSchema: typeof initializeSchema;
    parseReceiptText: typeof parseReceiptText;
    inferCategory: typeof inferCategory;
};
export {};
//# sourceMappingURL=db.d.ts.map