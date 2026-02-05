/**
 * Subscription service - database operations for user tiers and usage limits
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import {
  UserSubscription,
  UserSubscriptionRow,
  UsageLimits,
  UsageLimitsRow,
  TIER_LIMITS,
  UserTier,
} from '../models/subscription';

// Re-export for backward compatibility
export { UserTier };

// ============================================================================
// Row Mappers
// ============================================================================

function mapUserSubscriptionRow(row: UserSubscriptionRow): UserSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    subscriptionStatus: row.subscription_status,
    subscriptionStartDate: row.subscription_start_date,
    subscriptionEndDate: row.subscription_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUsageLimitsRow(row: UsageLimitsRow): UsageLimits {
  return {
    id: row.id,
    userId: row.user_id,
    month: row.month,
    receiptScans: row.receipt_scans,
    aiCalls: row.ai_calls,
    voiceSessions: row.voice_sessions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// User Subscription Operations
// ============================================================================

/**
 * Initialize schema for subscription tables
 * Called during database initialization
 */
export function initializeSubscriptionSchema(db: Database.Database): void {
  // User subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'family')),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_price_id TEXT,
      subscription_status TEXT DEFAULT 'incomplete' CHECK(subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
      subscription_start_date TEXT,
      subscription_end_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Usage limits table
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_limits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      receipt_scans INTEGER DEFAULT 0,
      ai_calls INTEGER DEFAULT 0,
      voice_sessions INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, month)
    );
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON usage_limits(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_limits_user_month ON usage_limits(user_id, month);
  `);
}

/**
 * Get or create user subscription record
 */
export function getOrCreateUserSubscription(userId: string): UserSubscription {
  const db = getDatabase();

  // Try to find existing subscription
  const findStmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_id = ?');
  const existing = findStmt.get(userId) as UserSubscriptionRow | undefined;

  if (existing) {
    return mapUserSubscriptionRow(existing);
  }

  // Create new free-tier subscription
  const now = new Date().toISOString();
  const id = uuidv4();

  const createStmt = db.prepare(`
    INSERT INTO user_subscriptions (id, user_id, tier, created_at, updated_at)
    VALUES (?, ?, 'free', ?, ?)
  `);

  createStmt.run(id, userId, now, now);

  return {
    id,
    userId,
    tier: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get user subscription by ID
 */
export function getUserSubscription(userId: string): UserSubscription | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_id = ?');
  const row = stmt.get(userId) as UserSubscriptionRow | undefined;

  return row ? mapUserSubscriptionRow(row) : null;
}

/**
 * Update user subscription with Stripe data
 */
export function updateUserSubscription(
  userId: string,
  updates: Partial<Omit<UserSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): UserSubscription | null {
  const db = getDatabase();

  const existing = getUserSubscription(userId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const updateFields: string[] = [];
  const params: (string | null)[] = [];

  if (updates.tier !== undefined) {
    updateFields.push('tier = ?');
    params.push(updates.tier);
  }
  if (updates.stripeCustomerId !== undefined) {
    updateFields.push('stripe_customer_id = ?');
    params.push(updates.stripeCustomerId);
  }
  if (updates.stripeSubscriptionId !== undefined) {
    updateFields.push('stripe_subscription_id = ?');
    params.push(updates.stripeSubscriptionId);
  }
  if (updates.stripePriceId !== undefined) {
    updateFields.push('stripe_price_id = ?');
    params.push(updates.stripePriceId);
  }
  if (updates.subscriptionStatus !== undefined) {
    updateFields.push('subscription_status = ?');
    params.push(updates.subscriptionStatus);
  }
  if (updates.subscriptionStartDate !== undefined) {
    updateFields.push('subscription_start_date = ?');
    params.push(updates.subscriptionStartDate);
  }
  if (updates.subscriptionEndDate !== undefined) {
    updateFields.push('subscription_end_date = ?');
    params.push(updates.subscriptionEndDate);
  }

  // Always update updated_at
  updateFields.push('updated_at = ?');
  params.push(now);

  // Add userId to params
  params.push(userId);

  const query = `UPDATE user_subscriptions SET ${updateFields.join(', ')} WHERE user_id = ?`;
  const stmt = db.prepare(query);
  stmt.run(...params);

  return getUserSubscription(userId);
}

/**
 * Downgrade user to free tier (for cancellations)
 */
export function downgradeToFree(userId: string): UserSubscription | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE user_subscriptions
    SET tier = 'free',
        stripe_subscription_id = NULL,
        stripe_price_id = NULL,
        subscription_status = 'canceled',
        subscription_end_date = ?,
        updated_at = ?
    WHERE user_id = ?
  `);

  stmt.run(now, now, userId);

  return getUserSubscription(userId);
}

// ============================================================================
// Usage Limits Operations
// ============================================================================

/**
 * Get current month string in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get or create usage limits for current month
 */
export function getOrCreateUsageLimits(userId: string): UsageLimits {
  const db = getDatabase();
  const month = getCurrentMonth();

  // Try to find existing limits
  const findStmt = db.prepare('SELECT * FROM usage_limits WHERE user_id = ? AND month = ?');
  const existing = findStmt.get(userId, month) as UsageLimitsRow | undefined;

  if (existing) {
    return mapUsageLimitsRow(existing);
  }

  // Create new usage limits record
  const now = new Date().toISOString();
  const id = uuidv4();

  const createStmt = db.prepare(`
    INSERT INTO usage_limits (id, user_id, month, receipt_scans, ai_calls, voice_sessions, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `);

  createStmt.run(id, userId, month, now, now);

  return {
    id,
    userId,
    month,
    receiptScans: 0,
    aiCalls: 0,
    voiceSessions: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Increment usage counter
 */
export function incrementUsage(
  userId: string,
  type: 'receiptScans' | 'aiCalls' | 'voiceSessions'
): UsageLimits {
  const db = getDatabase();
  const month = getCurrentMonth();
  const now = new Date().toISOString();

  // Ensure record exists
  getOrCreateUsageLimits(userId);

  const columnMap = {
    receiptScans: 'receipt_scans',
    aiCalls: 'ai_calls',
    voiceSessions: 'voice_sessions',
  };

  const stmt = db.prepare(`
    UPDATE usage_limits
    SET ${columnMap[type]} = ${columnMap[type]} + 1,
        updated_at = ?
    WHERE user_id = ? AND month = ?
  `);

  stmt.run(now, userId, month);

  return getOrCreateUsageLimits(userId);
}

/**
 * Get usage limits for a user
 */
export function getUsageLimits(userId: string): UsageLimits {
  return getOrCreateUsageLimits(userId);
}

// ============================================================================
// Tier Checking
// ============================================================================

/**
 * Check if user can add more items
 */
export function canAddItems(userId: string, currentItemCount: number): { allowed: boolean; remaining: number } {
  const subscription = getOrCreateUserSubscription(userId);
  const limit = TIER_LIMITS[subscription.tier].maxItems;

  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity as unknown as number };
  }

  const remaining = limit - currentItemCount;
  return { allowed: remaining > 0, remaining };
}

/**
 * Check if user can scan receipts
 */
export function canScanReceipt(userId: string): { allowed: boolean; remaining: number } {
  const subscription = getOrCreateUserSubscription(userId);
  const limit = TIER_LIMITS[subscription.tier].receiptScansPerMonth;

  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity as unknown as number };
  }

  const usage = getOrCreateUsageLimits(userId);
  const remaining = limit - usage.receiptScans;
  return { allowed: remaining > 0, remaining };
}

/**
 * Check if user can use AI features
 */
export function canUseAI(userId: string): { allowed: boolean; remaining: number } {
  const subscription = getOrCreateUserSubscription(userId);
  const limit = TIER_LIMITS[subscription.tier].aiCallsPerMonth;

  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity as unknown as number };
  }

  const usage = getOrCreateUsageLimits(userId);
  const remaining = limit - usage.aiCalls;
  return { allowed: remaining > 0, remaining };
}

/**
 * Check if user can use voice assistant
 */
export function canUseVoiceAssistant(userId: string): boolean {
  const subscription = getOrCreateUserSubscription(userId);
  return TIER_LIMITS[subscription.tier].voiceAssistant;
}

/**
 * Check if user has multi-device support
 */
export function hasMultiDevice(userId: string): boolean {
  const subscription = getOrCreateUserSubscription(userId);
  return TIER_LIMITS[subscription.tier].multiDevice;
}

/**
 * Check if user has shared inventory (family tier)
 */
export function hasSharedInventory(userId: string): boolean {
  const subscription = getOrCreateUserSubscription(userId);
  return TIER_LIMITS[subscription.tier].sharedInventory;
}

/**
 * Get user tier info for API response
 */
export function getUserTierInfo(
  userId: string,
  currentItemCount: number
) {
  const subscription = getOrCreateUserSubscription(userId);
  const usage = getOrCreateUsageLimits(userId);
  const limits = TIER_LIMITS[subscription.tier];

  return {
    tier: subscription.tier,
    limits: {
      maxItems: limits.maxItems === Infinity ? -1 : limits.maxItems,
      receiptScansPerMonth: limits.receiptScansPerMonth === Infinity ? -1 : limits.receiptScansPerMonth,
      aiCallsPerMonth: limits.aiCallsPerMonth === Infinity ? -1 : limits.aiCallsPerMonth,
      voiceAssistant: limits.voiceAssistant,
      multiDevice: limits.multiDevice,
      sharedInventory: limits.sharedInventory,
      maxFamilyMembers: limits.maxFamilyMembers,
    },
    usage: {
      currentItems: currentItemCount,
      receiptScansThisMonth: usage.receiptScans,
      aiCallsThisMonth: usage.aiCalls,
      voiceSessionsThisMonth: usage.voiceSessions,
    },
    subscription: subscription.stripeCustomerId
      ? {
          status: subscription.subscriptionStatus,
          stripeCustomerId: subscription.stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          subscriptionEndDate: subscription.subscriptionEndDate,
        }
      : null,
  };
}

// ============================================================================
// Migration
// ============================================================================

/**
 * Migrate existing users to free tier
 * Run this after schema initialization
 */
export function migrateExistingUsersToFreeTier(): void {
  const db = getDatabase();

  // Get all unique user_ids from pantry_items
  const userStmt = db.prepare('SELECT DISTINCT user_id FROM pantry_items');
  const users = userStmt.all() as { user_id: string }[];

  const now = new Date().toISOString();
  let migrated = 0;
  let skipped = 0;

  for (const { user_id } of users) {
    // Check if subscription record already exists
    const exists = db.prepare('SELECT 1 FROM user_subscriptions WHERE user_id = ?').get(user_id);

    if (exists) {
      skipped++;
      continue;
    }

    // Create free tier subscription
    const id = uuidv4();
    const createStmt = db.prepare(`
      INSERT INTO user_subscriptions (id, user_id, tier, created_at, updated_at)
      VALUES (?, ?, 'free', ?, ?)
    `);
    createStmt.run(id, user_id, now, now);
    migrated++;
  }

  console.log(`[MIGRATION] User subscriptions: ${migrated} migrated, ${skipped} skipped`);
}
