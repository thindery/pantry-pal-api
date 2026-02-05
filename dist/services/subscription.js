"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSubscriptionSchema = initializeSubscriptionSchema;
exports.getOrCreateUserSubscription = getOrCreateUserSubscription;
exports.getUserSubscription = getUserSubscription;
exports.updateUserSubscription = updateUserSubscription;
exports.downgradeToFree = downgradeToFree;
exports.getOrCreateUsageLimits = getOrCreateUsageLimits;
exports.incrementUsage = incrementUsage;
exports.getUsageLimits = getUsageLimits;
exports.canAddItems = canAddItems;
exports.canScanReceipt = canScanReceipt;
exports.canUseAI = canUseAI;
exports.canUseVoiceAssistant = canUseVoiceAssistant;
exports.hasMultiDevice = hasMultiDevice;
exports.hasSharedInventory = hasSharedInventory;
exports.getUserTierInfo = getUserTierInfo;
exports.migrateExistingUsersToFreeTier = migrateExistingUsersToFreeTier;
const uuid_1 = require("uuid");
const db_1 = require("../db");
const subscription_1 = require("../models/subscription");
function mapUserSubscriptionRow(row) {
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
function mapUsageLimitsRow(row) {
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
function initializeSubscriptionSchema(db) {
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
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON usage_limits(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_limits_user_month ON usage_limits(user_id, month);
  `);
}
function getOrCreateUserSubscription(userId) {
    const db = (0, db_1.getDatabase)();
    const findStmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_id = ?');
    const existing = findStmt.get(userId);
    if (existing) {
        return mapUserSubscriptionRow(existing);
    }
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
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
function getUserSubscription(userId) {
    const db = (0, db_1.getDatabase)();
    const stmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_id = ?');
    const row = stmt.get(userId);
    return row ? mapUserSubscriptionRow(row) : null;
}
function updateUserSubscription(userId, updates) {
    const db = (0, db_1.getDatabase)();
    const existing = getUserSubscription(userId);
    if (!existing)
        return null;
    const now = new Date().toISOString();
    const updateFields = [];
    const params = [];
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
    updateFields.push('updated_at = ?');
    params.push(now);
    params.push(userId);
    const query = `UPDATE user_subscriptions SET ${updateFields.join(', ')} WHERE user_id = ?`;
    const stmt = db.prepare(query);
    stmt.run(...params);
    return getUserSubscription(userId);
}
function downgradeToFree(userId) {
    const db = (0, db_1.getDatabase)();
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
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function getOrCreateUsageLimits(userId) {
    const db = (0, db_1.getDatabase)();
    const month = getCurrentMonth();
    const findStmt = db.prepare('SELECT * FROM usage_limits WHERE user_id = ? AND month = ?');
    const existing = findStmt.get(userId, month);
    if (existing) {
        return mapUsageLimitsRow(existing);
    }
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
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
function incrementUsage(userId, type) {
    const db = (0, db_1.getDatabase)();
    const month = getCurrentMonth();
    const now = new Date().toISOString();
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
function getUsageLimits(userId) {
    return getOrCreateUsageLimits(userId);
}
function canAddItems(userId, currentItemCount) {
    const subscription = getOrCreateUserSubscription(userId);
    const limit = subscription_1.TIER_LIMITS[subscription.tier].maxItems;
    if (limit === Infinity) {
        return { allowed: true, remaining: Infinity };
    }
    const remaining = limit - currentItemCount;
    return { allowed: remaining > 0, remaining };
}
function canScanReceipt(userId) {
    const subscription = getOrCreateUserSubscription(userId);
    const limit = subscription_1.TIER_LIMITS[subscription.tier].receiptScansPerMonth;
    if (limit === Infinity) {
        return { allowed: true, remaining: Infinity };
    }
    const usage = getOrCreateUsageLimits(userId);
    const remaining = limit - usage.receiptScans;
    return { allowed: remaining > 0, remaining };
}
function canUseAI(userId) {
    const subscription = getOrCreateUserSubscription(userId);
    const limit = subscription_1.TIER_LIMITS[subscription.tier].aiCallsPerMonth;
    if (limit === Infinity) {
        return { allowed: true, remaining: Infinity };
    }
    const usage = getOrCreateUsageLimits(userId);
    const remaining = limit - usage.aiCalls;
    return { allowed: remaining > 0, remaining };
}
function canUseVoiceAssistant(userId) {
    const subscription = getOrCreateUserSubscription(userId);
    return subscription_1.TIER_LIMITS[subscription.tier].voiceAssistant;
}
function hasMultiDevice(userId) {
    const subscription = getOrCreateUserSubscription(userId);
    return subscription_1.TIER_LIMITS[subscription.tier].multiDevice;
}
function hasSharedInventory(userId) {
    const subscription = getOrCreateUserSubscription(userId);
    return subscription_1.TIER_LIMITS[subscription.tier].sharedInventory;
}
function getUserTierInfo(userId, currentItemCount) {
    const subscription = getOrCreateUserSubscription(userId);
    const usage = getOrCreateUsageLimits(userId);
    const limits = subscription_1.TIER_LIMITS[subscription.tier];
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
function migrateExistingUsersToFreeTier() {
    const db = (0, db_1.getDatabase)();
    const userStmt = db.prepare('SELECT DISTINCT user_id FROM pantry_items');
    const users = userStmt.all();
    const now = new Date().toISOString();
    let migrated = 0;
    let skipped = 0;
    for (const { user_id } of users) {
        const exists = db.prepare('SELECT 1 FROM user_subscriptions WHERE user_id = ?').get(user_id);
        if (exists) {
            skipped++;
            continue;
        }
        const id = (0, uuid_1.v4)();
        const createStmt = db.prepare(`
      INSERT INTO user_subscriptions (id, user_id, tier, created_at, updated_at)
      VALUES (?, ?, 'free', ?, ?)
    `);
        createStmt.run(id, user_id, now, now);
        migrated++;
    }
    console.log(`[MIGRATION] User subscriptions: ${migrated} migrated, ${skipped} skipped`);
}
//# sourceMappingURL=subscription.js.map