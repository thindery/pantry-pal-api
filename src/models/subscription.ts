/**
 * Subscription-related type definitions for monetization
 */

// User subscription tiers
export type UserTier = 'free' | 'pro' | 'family';

// Stripe subscription status
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

// User subscription record
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

// Database row representation
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

// Usage limits per month
export interface UsageLimits {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  receiptScans: number;
  aiCalls: number;
  voiceSessions: number;
  createdAt: string;
  updatedAt: string;
}

// Database row representation
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

// Feature limits per tier
export const TIER_LIMITS = {
  free: {
    maxItems: 50,
    receiptScansPerMonth: 5,
    aiCallsPerMonth: 0,
    voiceAssistant: false,
    multiDevice: false,
    sharedInventory: false,
    maxFamilyMembers: 1,
  },
  pro: {
    maxItems: Infinity,
    receiptScansPerMonth: Infinity,
    aiCallsPerMonth: Infinity,
    voiceAssistant: true,
    multiDevice: true,
    sharedInventory: false,
    maxFamilyMembers: 1,
  },
  family: {
    maxItems: Infinity,
    receiptScansPerMonth: Infinity,
    aiCallsPerMonth: Infinity,
    voiceAssistant: true,
    multiDevice: true,
    sharedInventory: true,
    maxFamilyMembers: 5,
  },
};

// Tier pricing (for display purposes)
export const TIER_PRICING = {
  pro: {
    monthly: 499, // $4.99
    yearly: 3999, // $39.99 (33% savings)
    monthlyDisplay: '$4.99',
    yearlyDisplay: '$39.99',
  },
  family: {
    monthly: 799, // $7.99
    yearly: 5999, // $59.99 (37% savings)
    monthlyDisplay: '$7.99',
    yearlyDisplay: '$59.99',
  },
};

// Feature comparison for pricing page
export const FEATURE_COMPARISON = [
  { feature: 'Pantry Items', free: '50 max', pro: 'Unlimited', family: 'Unlimited' },
  { feature: 'AI Receipt Scanning', free: '5/month', pro: 'Unlimited', family: 'Unlimited' },
  { feature: 'Voice Assistant', free: '—', pro: '✓', family: '✓' },
  { feature: 'Cloud Sync', free: '1 device', pro: 'Multi-device', family: 'Multi-device' },
  { feature: 'Household Sharing', free: '—', pro: '—', family: 'Up to 5 members' },
  { feature: 'Advanced Analytics', free: '—', pro: '✓', family: '✓' },
  { feature: 'Low Stock Alerts', free: 'Basic', pro: 'Push notifications', family: 'Push notifications' },
  { feature: 'CSV Export', free: '—', pro: '✓', family: '✓' },
  { feature: 'Priority Support', free: '—', pro: '✓', family: '✓' },
];

// Checkout session request
export interface CreateCheckoutRequest {
  tier: 'pro' | 'family';
  billingInterval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
}

// Checkout session response
export interface CreateCheckoutResponse {
  sessionId: string;
  url: string;
}

// User tier info response
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

// Webhook event types we care about
export type StripeWebhookEvent =
  | 'checkout.session.completed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end';
