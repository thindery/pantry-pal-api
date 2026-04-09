export type ShoppingSessionStatus = 'active' | 'completed' | 'cancelled';
export interface ShoppingSession {
    id: string;
    userId: string;
    storeName?: string;
    startedAt: string;
    completedAt?: string;
    status: ShoppingSessionStatus;
    totalAmount: number;
    itemCount: number;
    receiptUrl?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ShoppingSessionRow {
    id: string;
    user_id: string;
    store_name: string | null;
    started_at: string;
    completed_at: string | null;
    status: ShoppingSessionStatus;
    total_amount: number;
    item_count: number;
    receipt_url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}
export interface SessionItem {
    id: string;
    sessionId: string;
    barcode?: string;
    name: string;
    quantity: number;
    unit?: string;
    price?: number;
    category?: string;
    addedAt: string;
    updatedAt: string;
}
export interface SessionItemRow {
    id: string;
    session_id: string;
    barcode: string | null;
    name: string;
    quantity: number;
    unit: string | null;
    price: number | null;
    category: string | null;
    added_at: string;
    updated_at: string;
}
export interface CreateSessionRequest {
    storeName?: string;
    notes?: string;
}
export interface AddSessionItemRequest {
    barcode?: string;
    name: string;
    quantity?: number;
    unit?: string;
    price?: number;
    category?: string;
}
export interface CompleteSessionRequest {
    receiptUrl?: string;
    notes?: string;
}
export interface ShoppingSessionWithItems extends ShoppingSession {
    items: SessionItem[];
}
export interface ShoppingSessionListItem {
    id: string;
    storeName?: string;
    startedAt: string;
    completedAt?: string;
    status: ShoppingSessionStatus;
    totalAmount: number;
    itemCount: number;
}
export interface SessionSummary {
    totalSessions: number;
    totalSpent: number;
    averageSessionValue: number;
}
export interface SessionReceipt {
    id: string;
    sessionId: string;
    imageData: string;
    mimeType: string;
    notes?: string;
    capturedAt: string;
    createdAt: string;
}
export interface SessionReceiptRow {
    id: string;
    session_id: string;
    image_data: string;
    mime_type: string;
    notes: string | null;
    captured_at: string;
    created_at: string;
}
export interface CaptureReceiptRequest {
    imageData: string;
    mimeType: string;
    notes?: string;
}
//# sourceMappingURL=shoppingSession.d.ts.map