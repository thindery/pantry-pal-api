export type UserTier = 'free' | 'pro' | 'family';
export type SubscriptionStatus = 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
export interface UserSubscription {
    id: string;
    userId: string;
    tier: UserTier;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionStartDate: string | null;
    subscriptionEndDate: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface UserSubscriptionRow {
    id: string;
    user_id: string;
    tier: UserTier;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    subscription_status: SubscriptionStatus | null;
    subscription_start_date: string | null;
    subscription_end_date: string | null;
    created_at: string;
    updated_at: string;
}
export interface UsageLimits {
    id: string;
    userId: string;
    month: string;
    receiptScans: number;
    aiCalls: number;
    voiceSessions: number;
    createdAt: string;
    updatedAt: string;
}
export interface UsageLimitsRow {
    id: string;
    user_id: string;
    month: string;
    receipt_scans: number;
    ai_calls: number;
    voice_sessions: number;
    created_at: string;
    updated_at: string;
}
export declare const TIER_LIMITS: {
    free: {
        maxItems: number;
        receiptScansPerMonth: number;
        aiCallsPerMonth: number;
        voiceAssistant: boolean;
        multiDevice: boolean;
        sharedInventory: boolean;
        maxFamilyMembers: number;
    };
    pro: {
        maxItems: number;
        receiptScansPerMonth: number;
        aiCallsPerMonth: number;
        voiceAssistant: boolean;
        multiDevice: boolean;
        sharedInventory: boolean;
        maxFamilyMembers: number;
    };
    family: {
        maxItems: number;
        receiptScansPerMonth: number;
        aiCallsPerMonth: number;
        voiceAssistant: boolean;
        multiDevice: boolean;
        sharedInventory: boolean;
        maxFamilyMembers: number;
    };
};
export declare const TIER_PRICING: {
    pro: {
        monthly: number;
        yearly: number;
        monthlyDisplay: string;
        yearlyDisplay: string;
    };
    family: {
        monthly: number;
        yearly: number;
        monthlyDisplay: string;
        yearlyDisplay: string;
    };
};
export declare const FEATURE_COMPARISON: {
    feature: string;
    free: string;
    pro: string;
    family: string;
}[];
export interface CreateCheckoutRequest {
    tier: 'pro' | 'family';
    billingInterval: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
}
export interface CreateCheckoutResponse {
    sessionId: string;
    url: string;
}
export interface UserTierInfo {
    tier: UserTier;
    limits: {
        maxItems: number;
        receiptScansPerMonth: number;
        aiCallsPerMonth: number;
        voiceAssistant: boolean;
        multiDevice: boolean;
        sharedInventory: boolean;
        maxFamilyMembers: number;
    };
    usage: {
        currentItems: number;
        receiptScansThisMonth: number;
        aiCallsThisMonth: number;
        voiceSessionsThisMonth: number;
    };
    subscription: {
        status: SubscriptionStatus | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        subscriptionEndDate: string | null;
    } | null;
}
export type StripeWebhookEvent = 'checkout.session.completed' | 'invoice.paid' | 'invoice.payment_failed' | 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted' | 'customer.subscription.trial_will_end';
//# sourceMappingURL=subscription.d.ts.map