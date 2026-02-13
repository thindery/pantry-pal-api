import { DatabaseAdapter, CreateItemInput, UpdateItemInput } from './adapter';
import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult } from '../models/types';
export declare class PostgresAdapter implements DatabaseAdapter {
    private pool;
    initialize(): void;
    close(): void;
    private getPool;
    private initializeSchema;
    private initializeSubscriptionSchema;
    getAllItems(userId: string, category?: string): Promise<PantryItem[]>;
    getItemById(userId: string, id: string): Promise<PantryItem | null>;
    getItemByName(userId: string, name: string): Promise<PantryItem | null>;
    createItem(userId: string, input: CreateItemInput): Promise<PantryItem>;
    updateItem(userId: string, id: string, input: UpdateItemInput): Promise<PantryItem | null>;
    deleteItem(userId: string, id: string): Promise<boolean>;
    adjustItemQuantity(userId: string, id: string, adjustment: number): Promise<PantryItem | null>;
    getCategories(userId: string): Promise<string[]>;
    getActivities(userId: string, limit?: number, offset?: number, itemId?: string): Promise<Activity[]>;
    getActivityCount(userId: string, itemId?: string): Promise<number>;
    logActivity(userId: string, itemId: string, type: ActivityType, amount: number, source?: ActivitySource): Promise<Activity | null>;
    processReceiptScan(rawData: string | ScanResult[]): ScanResult[];
    private parseReceiptText;
    private inferCategory;
    processVisualUsage(userId: string, detections: UsageResult[], source?: string): Promise<{
        processed: UsageResult[];
        activities: Activity[];
        errors: string[];
    }>;
    query(sql: string, params?: unknown[]): Promise<unknown[]>;
    execute(sql: string, params?: unknown[]): Promise<{
        changes: number;
        lastID?: string | number;
    }>;
    transaction<T>(fn: () => Promise<T> | T): Promise<T>;
}
//# sourceMappingURL=postgres.d.ts.map