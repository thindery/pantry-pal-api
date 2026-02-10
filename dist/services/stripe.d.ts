import Stripe from 'stripe';
declare const stripe: Stripe;
export declare function ensureStripeProducts(): Promise<void>;
export interface CreateCheckoutOptions {
    userId: string;
    tier: 'pro' | 'family';
    billingInterval: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
}
export interface CheckoutSession {
    sessionId: string;
    url: string;
}
export declare function createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSession>;
export declare function createCustomerPortalSession(userId: string, returnUrl: string): Promise<{
    url: string;
}>;
export declare function handleWebhookEvent(payload: string, signature: string): Promise<{
    received: boolean;
    event?: Stripe.Event;
}>;
export { stripe };
export declare function getPriceIds(): {
    pro: {
        monthly: string;
        yearly: string;
    };
    family: {
        monthly: string;
        yearly: string;
    };
};
//# sourceMappingURL=stripe.d.ts.map