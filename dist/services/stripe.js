"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
exports.ensureStripeProducts = ensureStripeProducts;
exports.createCheckoutSession = createCheckoutSession;
exports.createCustomerPortalSession = createCustomerPortalSession;
exports.handleWebhookEvent = handleWebhookEvent;
exports.getPriceIds = getPriceIds;
const stripe_1 = __importDefault(require("stripe"));
const subscription_1 = require("./subscription");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
    typescript: true,
});
exports.stripe = stripe;
const PRICE_IDS = {
    pro: {
        month: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
        year: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
    },
    family: {
        month: process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID || '',
        year: process.env.STRIPE_FAMILY_YEARLY_PRICE_ID || '',
    },
};
const PRODUCT_NAMES = {
    pro: 'PantryPal Pro',
    family: 'PantryPal Family',
};
async function ensureStripeProducts() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.log('[STRIPE] SKIPPED - No Stripe secret key configured');
        return;
    }
    try {
        if (!PRICE_IDS.pro.month) {
            const proProduct = await stripe.products.create({
                name: PRODUCT_NAMES.pro,
                description: 'Unlimited items, AI receipt scanning, voice assistant, multi-device sync',
            });
            const proMonthly = await stripe.prices.create({
                product: proProduct.id,
                unit_amount: 499,
                currency: 'usd',
                recurring: { interval: 'month' },
                nickname: 'Pro Monthly',
            });
            const proYearly = await stripe.prices.create({
                product: proProduct.id,
                unit_amount: 3999,
                currency: 'usd',
                recurring: { interval: 'year' },
                nickname: 'Pro Yearly (33% off)',
            });
            console.log('[STRIPE] Created Pro product:');
            console.log(`  Monthly: ${proMonthly.id}`);
            console.log(`  Yearly: ${proYearly.id}`);
            console.log(`  Add to env: STRIPE_PRO_MONTHLY_PRICE_ID=${proMonthly.id}`);
            console.log(`  Add to env: STRIPE_PRO_YEARLY_PRICE_ID=${proYearly.id}`);
        }
        if (!PRICE_IDS.family.month) {
            const familyProduct = await stripe.products.create({
                name: PRODUCT_NAMES.family,
                description: 'Everything in Pro + 5 household members + shared inventory',
            });
            const familyMonthly = await stripe.prices.create({
                product: familyProduct.id,
                unit_amount: 799,
                currency: 'usd',
                recurring: { interval: 'month' },
                nickname: 'Family Monthly',
            });
            const familyYearly = await stripe.prices.create({
                product: familyProduct.id,
                unit_amount: 5999,
                currency: 'usd',
                recurring: { interval: 'year' },
                nickname: 'Family Yearly (37% off)',
            });
            console.log('[STRIPE] Created Family product:');
            console.log(`  Monthly: ${familyMonthly.id}`);
            console.log(`  Yearly: ${familyYearly.id}`);
            console.log(`  Add to env: STRIPE_FAMILY_MONTHLY_PRICE_ID=${familyMonthly.id}`);
            console.log(`  Add to env: STRIPE_FAMILY_YEARLY_PRICE_ID=${familyYearly.id}`);
        }
        if (PRICE_IDS.pro.month && PRICE_IDS.family.month) {
            console.log('[STRIPE] All products and prices already configured');
        }
    }
    catch (error) {
        console.error('[STRIPE] Failed to ensure products:', error);
        throw error;
    }
}
async function createCheckoutSession(options) {
    const { userId, tier, billingInterval, successUrl, cancelUrl } = options;
    const priceId = PRICE_IDS[tier][billingInterval];
    if (!priceId) {
        throw new Error(`Price not configured for ${tier}/${billingInterval}`);
    }
    let customerId;
    const existingSub = (0, subscription_1.getUserSubscription)(userId);
    if (existingSub?.stripeCustomerId) {
        customerId = existingSub.stripeCustomerId;
    }
    else {
        const customer = await stripe.customers.create({
            metadata: { userId },
        });
        customerId = customer.id;
        (0, subscription_1.updateUserSubscription)(userId, {
            stripeCustomerId: customerId,
        });
    }
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        subscription_data: {
            metadata: {
                userId,
                tier,
            },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            userId,
            tier,
        },
    });
    if (!session.url) {
        throw new Error('Checkout session created without URL');
    }
    return {
        sessionId: session.id,
        url: session.url,
    };
}
async function createCustomerPortalSession(userId, returnUrl) {
    const subscription = (0, subscription_1.getUserSubscription)(userId);
    if (!subscription?.stripeCustomerId) {
        throw new Error('No Stripe customer found for this user');
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
    });
    return { url: session.url };
}
async function handleWebhookEvent(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
        console.warn('[STRIPE] Webhook secret not configured');
        return { received: false };
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }
    catch (err) {
        console.error('[STRIPE] Webhook signature verification failed:', err);
        throw new Error('Invalid signature');
    }
    console.log(`[STRIPE] Webhook received: ${event.type}`);
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            await handleCheckoutSessionCompleted(session);
            break;
        }
        case 'invoice.paid': {
            const invoice = event.data.object;
            await handleInvoicePaid(invoice);
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            await handleInvoicePaymentFailed(invoice);
            break;
        }
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            await handleSubscriptionUpdated(subscription);
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            await handleSubscriptionDeleted(subscription);
            break;
        }
        default:
            console.log(`[STRIPE] Unhandled event type: ${event.type}`);
    }
    return { received: true, event };
}
async function handleCheckoutSessionCompleted(session) {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;
    if (!userId || !tier) {
        console.error('[STRIPE] Missing metadata in checkout session');
        return;
    }
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
        console.error('[STRIPE] No subscription in checkout session');
        return;
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const sub = subscription;
    const priceId = subscription.items.data[0]?.price.id;
    (0, subscription_1.updateUserSubscription)(userId, {
        tier,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId || null,
        subscriptionStatus: subscription.status,
        subscriptionStartDate: new Date(sub.current_period_start * 1000).toISOString(),
        subscriptionEndDate: new Date(sub.current_period_end * 1000).toISOString(),
    });
    console.log(`[STRIPE] Subscription activated for user ${userId}: ${tier}`);
}
async function handleInvoicePaid(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId)
        return;
    console.log(`[STRIPE] Invoice paid for subscription ${subscriptionId}`);
}
async function handleInvoicePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId)
        return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('[STRIPE] No userId in subscription metadata');
        return;
    }
    (0, subscription_1.updateUserSubscription)(userId, {
        subscriptionStatus: 'past_due',
    });
    console.log(`[STRIPE] Payment failed for user ${userId}`);
}
async function handleSubscriptionUpdated(subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('[STRIPE] No userId in subscription metadata');
        return;
    }
    const tier = subscription.metadata?.tier;
    const priceId = subscription.items.data[0]?.price.id;
    (0, subscription_1.updateUserSubscription)(userId, {
        tier: tier || undefined,
        stripePriceId: priceId || undefined,
        subscriptionStatus: subscription.status,
        subscriptionEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
    });
    console.log(`[STRIPE] Subscription updated for user ${userId}: ${subscription.status}`);
}
async function handleSubscriptionDeleted(subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
        console.error('[STRIPE] No userId in subscription metadata');
        return;
    }
    (0, subscription_1.downgradeToFree)(userId);
    console.log(`[STRIPE] Subscription canceled for user ${userId}, downgraded to free`);
}
function getPriceIds() {
    return {
        pro: { monthly: PRICE_IDS.pro.month, yearly: PRICE_IDS.pro.year },
        family: { monthly: PRICE_IDS.family.month, yearly: PRICE_IDS.family.year },
    };
}
//# sourceMappingURL=stripe.js.map