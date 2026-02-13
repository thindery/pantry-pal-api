export type ActivityType = 'ADD' | 'REMOVE' | 'ADJUST';
export type ActivitySource = 'MANUAL' | 'RECEIPT_SCAN' | 'VISUAL_USAGE';
export interface PantryItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    lastUpdated: string;
    userId: string;
    barcode?: string;
}
export interface PantryItemRow {
    id: string;
    name: string;
    barcode: string | null;
    quantity: number;
    unit: string;
    category: string;
    last_updated: string;
    user_id: string;
}
export interface Activity {
    id: string;
    itemId: string;
    itemName: string;
    type: ActivityType;
    amount: number;
    timestamp: string;
    source: ActivitySource;
    userId: string;
}
export interface ActivityRow {
    id: string;
    item_id: string;
    item_name: string;
    type: ActivityType;
    amount: number;
    timestamp: string;
    source: ActivitySource;
    user_id: string;
}
export interface ScanResult {
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
}
export interface UsageResult {
    name: string;
    quantityUsed: number;
}
export type CreateItemInput = {
    name: string;
    quantity: number;
    unit: string;
    category: string;
};
export type UpdateItemInput = {
    name?: string;
    quantity?: number;
    unit?: string;
    category?: string;
};
export interface CreateItemRequest {
    name: string;
    quantity: number;
    unit: string;
    category: string;
}
export interface UpdateItemRequest {
    name?: string;
    quantity?: number;
    unit?: string;
    category?: string;
}
export interface CreateActivityRequest {
    itemId: string;
    type: ActivityType;
    amount: number;
    source?: ActivitySource;
}
export interface ScanReceiptRequest {
    scanData: string | ScanResult[];
    minConfidence?: number;
}
export interface VisualUsageRequest {
    detections: UsageResult[];
    detectionSource?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ResponseMeta;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface ResponseMeta {
    total?: number;
    page?: number;
    limit?: number;
    timestamp: string;
}
export interface ProductInfo {
    barcode: string;
    name: string;
    brand?: string;
    category: string;
    imageUrl?: string;
    ingredients?: string;
    nutrition?: Record<string, number>;
    source: string;
    infoLastSynced: string;
}
export interface BarcodeLookupResponse {
    success: boolean;
    cached: boolean;
    product?: ProductInfo;
    error?: string;
    stale?: boolean;
}
export interface ProductCacheInput {
    barcode: string;
    name: string;
    brand?: string;
    category: string;
    imageUrl?: string;
    ingredients?: string;
    nutrition?: Record<string, number>;
    source: string;
}
export interface DatabaseConfig {
    path: string;
    verbose?: boolean;
}
//# sourceMappingURL=types.d.ts.map