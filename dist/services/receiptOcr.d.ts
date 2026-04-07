export interface ReceiptItem {
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
    price?: number;
    confidence?: number;
}
export interface ReceiptScanResult {
    items: ReceiptItem[];
    store?: string;
    date?: string;
    total?: number;
    rawText: string;
    confidence: number;
}
export declare function scanReceiptImage(base64Image: string): Promise<ReceiptScanResult>;
//# sourceMappingURL=receiptOcr.d.ts.map