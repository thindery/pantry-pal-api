import { PantryItem, Activity, ActivityType, ActivitySource, ScanResult, UsageResult, ProductInfo, ProductCacheInput } from '../models/types';
import { ShoppingSession, ShoppingSessionWithItems, SessionItem, SessionSummary } from '../models/shoppingSession';
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
export interface CreateSessionInput {
    storeName?: string;
    notes?: string;
}
export interface AddSessionItemInput {
    barcode?: string;
    name: string;
    quantity: number;
    unit?: string;
    price?: number;
    category?: string;
}
export interface CompleteSessionInput {
    receiptUrl?: string;
    notes?: string;
}
export interface DatabaseAdapter {
    initialize(): void;
    close(): void;
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
    processVisualUsage(userId: string, detections: UsageResult[], source?: string): Promise<{
        processed: UsageResult[];
        activities: Activity[];
        errors: string[];
    }>;
    getProductByBarcode(barcode: string, maxAgeDays?: number): Promise<ProductInfo | null>;
    saveProduct(input: ProductCacheInput): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<unknown[]> | unknown[];
    execute(sql: string, params?: unknown[]): Promise<{
        changes: number;
        lastID?: string | number;
    }>;
    transaction<T>(fn: () => T): Promise<T> | T;
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
    removeSessionItem(userId: string, sessionId: string, itemId: string): Promise<boolean>;
    completeSession(userId: string, sessionId: string, input: CompleteSessionInput): Promise<ShoppingSession | null>;
    updateSessionReceipt(userId: string, sessionId: string, receiptUrl: string): Promise<ShoppingSession | null>;
    cancelSession(userId: string, sessionId: string): Promise<boolean>;
    getSessionSummary(userId: string): Promise<SessionSummary>;
    addSessionToInventory(userId: string, sessionId: string): Promise<{
        items: PantryItem[];
        activities: Activity[];
    }>;
    captureSessionReceipt(userId: string, sessionId: string, imageData: string, mimeType: string, notes?: string): Promise<SessionReceipt>;
    getSessionReceipts(userId: string, sessionId: string): Promise<SessionReceipt[]>;
    getSessionReceiptById(userId: string, sessionId: string, receiptId: string): Promise<SessionReceipt | null>;
    deleteSessionReceipt(userId: string, sessionId: string, receiptId: string): Promise<boolean>;
}
//# sourceMappingURL=adapter.d.ts.map