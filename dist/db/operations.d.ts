import { CreateItemInput, UpdateItemInput } from './adapter';
import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult } from '../models/types';
export declare function getAllItems(userId: string, category?: string): Promise<PantryItem[]>;
export declare function getItemById(userId: string, id: string): Promise<PantryItem | null>;
export declare function getItemByName(userId: string, name: string): Promise<PantryItem | null>;
export declare function createItem(userId: string, input: CreateItemInput): Promise<PantryItem>;
export declare function updateItem(userId: string, id: string, input: UpdateItemInput): Promise<PantryItem | null>;
export declare function deleteItem(userId: string, id: string): Promise<boolean>;
export declare function adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null>;
export declare function getCategories(userId: string): Promise<string[]>;
export declare function getActivities(userId: string, limit?: number, offset?: number, itemId?: string): Promise<Activity[]>;
export declare function getActivityCount(userId: string, itemId?: string): Promise<number>;
export declare function logActivity(userId: string, itemId: string, type: ActivityType, amount: number, source?: ActivitySource): Promise<Activity | null>;
export declare function processReceiptScan(rawData: string | ScanResult[]): ScanResult[];
export declare function processVisualUsage(userId: string, detections: UsageResult[], source?: string): Promise<{
    processed: UsageResult[];
    activities: Activity[];
    errors: string[];
}>;
//# sourceMappingURL=operations.d.ts.map