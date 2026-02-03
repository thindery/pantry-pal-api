import Database from 'better-sqlite3';
import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult } from './models/types';
export declare function getDatabase(): Database.Database;
export declare function closeDatabase(): void;
declare function initializeSchema(): void;
export declare function getAllItems(category?: string): PantryItem[];
export declare function getItemById(id: string): PantryItem | null;
export declare function getItemByName(name: string): PantryItem | null;
export interface CreateItemInput {
    name: string;
    quantity: number;
    unit: string;
    category: string;
}
export interface UpdateItemInput {
    name?: string;
    quantity?: number;
    unit?: string;
    category?: string;
}
export declare function createItem(input: CreateItemInput): PantryItem;
export declare function updateItem(id: string, input: UpdateItemInput): PantryItem | null;
export declare function deleteItem(id: string): boolean;
export declare function adjustItemQuantity(id: string, adjustment: number): PantryItem | null;
export declare function getCategories(): string[];
export declare function getActivities(limit?: number, offset?: number, itemId?: string): Activity[];
export declare function getActivityCount(itemId?: string): number;
export declare function logActivity(itemId: string, type: ActivityType, amount: number, source?: ActivitySource): Activity | null;
export declare function processReceiptScan(rawData: string | ScanResult[]): ScanResult[];
declare function parseReceiptText(text: string): ScanResult[];
declare function inferCategory(name: string): string;
export declare function processVisualUsage(detections: UsageResult[], source?: string): {
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