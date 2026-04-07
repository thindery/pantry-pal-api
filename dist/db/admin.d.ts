export interface TransactionData {
    userId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeInvoiceId?: string;
    amountCents: number;
    currency?: string;
    status: 'succeeded' | 'failed' | 'pending' | 'refunded';
    tier?: 'free' | 'pro' | 'family';
    billingInterval?: 'month' | 'year';
    failureCode?: string;
    failureMessage?: string;
    stripeEventId?: string;
}
export interface Transaction {
    id: string;
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeInvoiceId: string | null;
    amountCents: number;
    currency: string;
    status: string;
    tier: string | null;
    billingInterval: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: string;
    stripeEventId: string | null;
}
export interface DashboardMetrics {
    users: {
        total: number;
        growth: number;
        sparkline: number[];
    };
    products: {
        total: number;
        byCategory: Record<string, number>;
    };
    revenue: {
        lifetime: number;
        momGrowth: number;
        trend: number[];
    };
    logins: {
        dau: number;
        sparkline: number[];
    };
    transactions: Transaction[];
    failedPayments: {
        count: number;
        recent: Transaction[];
    };
}
export interface FailedPaymentAlert {
    id: string;
    userId: string;
    amountCents: number;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: string;
}
export declare function recordLoginEvent(userId: string, source?: string): Promise<void>;
export declare function recordTransaction(data: TransactionData): Promise<void>;
export declare function getTransactions(limit?: number, cursor?: string): Promise<{
    transactions: Transaction[];
    nextCursor?: string;
}>;
export declare function getFailedPaymentAlerts(): Promise<{
    count: number;
    recent: FailedPaymentAlert[];
}>;
export declare function getDashboardMetrics(period: '7d' | '30d' | '90d'): Promise<DashboardMetrics>;
//# sourceMappingURL=admin.d.ts.map