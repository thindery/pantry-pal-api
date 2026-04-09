import { DatabaseAdapter, CreateItemInput, UpdateItemInput, CreateSessionInput, AddSessionItemInput, CompleteSessionInput } from './adapter';
import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult, ProductInfo, ProductCacheInput } from '../models/types';
import { ShoppingSession, SessionItem, ShoppingSessionWithItems, SessionSummary } from '../models/shoppingSession';
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
    getProductByBarcode(barcode: string, maxAgeDays?: number): Promise<ProductInfo | null>;
    saveProduct(input: ProductCacheInput): Promise<void>;
    saveClientError(error: {
        userId?: string;
        errorType: string;
        errorMessage: string;
        errorStack?: string;
        component?: string;
        url?: string;
        userAgent?: string;
    }): Promise<{
        id: string;
    }>;
    getClientErrors(filters: {
        resolved?: boolean;
        limit?: number;
    }): Promise<Array<{
        id: string;
        user_id: string | null;
        error_type: string;
        error_message: string;
        error_stack: string | null;
        component: string | null;
        url: string | null;
        user_agent: string | null;
        resolved: boolean;
        created_at: string;
    }>>;
    markErrorResolved(id: string): Promise<void>;
    createSession(userId: string, input: CreateSessionInput): Promise<ShoppingSession>;
    getSessionById(userId: string, sessionId: string): Promise<ShoppingSessionWithItems | null>;
    getUserSessions(userId: string, limit?: number, offset?: number, status?: string): Promise<ShoppingSession[]>;
    getSessionCount(userId: string, status?: string): Promise<number>;
    addSessionItem(userId: string, sessionId: string, input: AddSessionItemInput): Promise<SessionItem>;
    removeSessionItem(_userId: string, sessionId: string, itemId: string): Promise<boolean>;
    completeSession(userId: string, sessionId: string, input: CompleteSessionInput): Promise<ShoppingSession | null>;
    cancelSession(userId: string, sessionId: string): Promise<boolean>;
    getSessionSummary(userId: string): Promise<SessionSummary>;
}
//# sourceMappingURL=postgres.d.ts.map