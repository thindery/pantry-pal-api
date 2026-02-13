/**
 * Stripe service for payment processing and subscription management
 */

import Stripe from 'stripe';
import {
  getUserSubscription,
  updateUserSubscription,
  downgradeToFree,
} from './subscription';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

// Price IDs from environment variables
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

// Product name mapping
const PRODUCT_NAMES = {
  pro: 'PantryPal Pro',
  family: 'PantryPal Family',
};

// ============================================================================
// Product & Price Setup
// ============================================================================

/**
 * Ensure Stripe products and prices are created
 * Call this during server startup or via admin CLI
 */
export async function ensureStripeProducts(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('[STRIPE] SKIPPED - No Stripe secret key configured');
    return;
  }

  try {
    // Check if products already exist by querying Stripe
    const existingProducts = await stripe.products.list({ limit: 10 });
    const existingNames = new Set(existingProducts.data.map(p => p.name));
    
    // Check if Pro monthly price exists (either from env or existing on Stripe)
    const hasProMonthly = PRICE_IDS.pro.month || existingNames.has(PRODUCT_NAMES.pro);
    const hasFamilyMonthly = PRICE_IDS.family.month || existingNames.has(PRODUCT_NAMES.family);
    
    if (!hasProMonthly) {
      const proProduct = await stripe.products.create({
        name: PRODUCT_NAMES.pro,
        description: 'Unlimited items, AI receipt scanning, voice assistant, multi-device sync',
      });

      const proMonthly = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 499, // $4.99
        currency: 'usd',
        recurring: { interval: 'month' },
        nickname: 'Pro Monthly',
      });

      const proYearly = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 3999, // $39.99
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

    if (!hasFamilyMonthly) {
      const familyProduct = await stripe.products.create({
        name: PRODUCT_NAMES.family,
        description: 'Everything in Pro + 5 household members + shared inventory',
      });

      const familyMonthly = await stripe.prices.create({
        product: familyProduct.id,
        unit_amount: 799, // $7.99
        currency: 'usd',
        recurring: { interval: 'month' },
        nickname: 'Family Monthly',
      });

      const familyYearly = await stripe.prices.create({
        product: familyProduct.id,
        unit_amount: 5999, // $59.99
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
  } catch (error) {
    console.error('[STRIPE] Failed to ensure products:', error);
    throw error;
  }
}

// ============================================================================
// Checkout Session
// ============================================================================

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

/**
 * Create a checkout session for subscription signup
 */
export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<CheckoutSession> {
  const { userId, tier, billingInterval, successUrl, cancelUrl } = options;

  const priceId = PRICE_IDS[tier][billingInterval];
  if (!priceId) {
    throw new Error(`Price not configured for ${tier}/${billingInterval}`);
  }

  // Get or create customer (we'll create a new one or use existing)
  let customerId: string;
  const existingSub = await getUserSubscription(userId);

  if (existingSub?.stripeCustomerId) {
    customerId = existingSub.stripeCustomerId;
  } else {
    // Create a new customer
    const customer = await stripe.customers.create({
      metadata: { userId },
    });
    customerId = customer.id;

    // Store customer ID
    updateUserSubscription(userId, {
      stripeCustomerId: customerId,
    });
  }

  // Create checkout session
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

// ============================================================================
// Customer Portal
// ============================================================================

/**
 * Create a customer portal session for managing subscriptions
 */
export async function createCustomerPortalSession(
  userId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const subscription = await getUserSubscription(userId);

  if (!subscription?.stripeCustomerId) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ============================================================================
// Webhook Handling
// ============================================================================

export async function handleWebhookEvent(
  payload: string,
  signature: string
): Promise<{ received: boolean; event?: Stripe.Event }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.warn('[STRIPE] Webhook secret not configured');
    return { received: false };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('[STRIPE] Webhook signature verification failed:', err);
    throw new Error('Invalid signature');
  }

  console.log(`[STRIPE] Webhook received: ${event.type}`);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailed(invoice);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }

    default:
      console.log(`[STRIPE] Unhandled event type: ${event.type}`);
  }

  return { received: true, event };
}

/**
 * Handle checkout.session.completed
 * This is the main event for new subscriptions
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as 'pro' | 'family' | undefined;

  if (!userId || !tier) {
    console.error('[STRIPE] Missing metadata in checkout session');
    return;
  }

  // Get subscription details
  const subscriptionId = (session as any).subscription;
  if (!subscriptionId) {
    console.error('[STRIPE] No subscription in checkout session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const sub = subscription as any;

  // Update user subscription in database
  const priceId = subscription.items.data[0]?.price.id;

  updateUserSubscription(userId, {
    tier,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId || null,
    subscriptionStatus: subscription.status as any,
    subscriptionStartDate: new Date(sub.current_period_start * 1000).toISOString(),
    subscriptionEndDate: new Date(sub.current_period_end * 1000).toISOString(),
  });

  console.log(`[STRIPE] Subscription activated for user ${userId}: ${tier}`);
}

/**
 * Handle invoice.paid
 * Confirms ongoing subscription payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) return;

  // Find user by customer ID
  // We need to query the database to find the user with this stripe_customer_id
  // For now, we'll just log it
  console.log(`[STRIPE] Invoice paid for subscription ${subscriptionId}`);
}

/**
 * Handle invoice.payment_failed
 * Payment failed - may need to handle grace period
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('[STRIPE] No userId in subscription metadata');
    return;
  }

  updateUserSubscription(userId, {
    subscriptionStatus: 'past_due',
  });

  console.log(`[STRIPE] Payment failed for user ${userId}`);
}

/**
 * Handle customer.subscription.updated
 * Subscription changed - upgrade/downgrade/etc
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('[STRIPE] No userId in subscription metadata');
    return;
  }

  const tier = subscription.metadata?.tier as 'pro' | 'family' | undefined;
  const priceId = subscription.items.data[0]?.price.id;

  updateUserSubscription(userId, {
    tier: tier || undefined,
    stripePriceId: priceId || undefined,
    subscriptionStatus: subscription.status as any,
    subscriptionEndDate: new Date((subscription as any).current_period_end * 1000).toISOString(),
  });

  console.log(`[STRIPE] Subscription updated for user ${userId}: ${subscription.status}`);
}

/**
 * Handle customer.subscription.deleted
 * Cancellation at period end or immediate
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('[STRIPE] No userId in subscription metadata');
    return;
  }

  downgradeToFree(userId);

  console.log(`[STRIPE] Subscription canceled for user ${userId}, downgraded to free`);
}

// ============================================================================
// Export raw stripe client for advanced use cases
// ============================================================================

export { stripe };

/**
 * Price IDs for client-side use
 */
export function getPriceIds() {
  return {
    pro: { monthly: PRICE_IDS.pro.month, yearly: PRICE_IDS.pro.year },
    family: { monthly: PRICE_IDS.family.month, yearly: PRICE_IDS.family.year },
  };
}
