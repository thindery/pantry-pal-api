"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTier = requireTier;
exports.checkItemLimit = checkItemLimit;
exports.trackReceiptScan = trackReceiptScan;
exports.checkVoiceAssistantAccess = checkVoiceAssistantAccess;
exports.trackVoiceSession = trackVoiceSession;
const subscription_1 = require("../services/subscription");
const subscription_2 = require("../models/subscription");
const db_1 = require("../db");
function requireTier(minimumTier) {
    return async (req, res, next) => {
        try {
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                    meta: { timestamp: new Date().toISOString() },
                });
                return;
            }
            const subscription = await (0, subscription_1.getOrCreateUserSubscription)(userId);
            const tierLevels = { free: 0, pro: 1, family: 2 };
            if (tierLevels[subscription.tier] < tierLevels[minimumTier]) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'UPGRADE_REQUIRED',
                        message: `This feature requires ${minimumTier} tier or higher`,
                        details: {
                            currentTier: subscription.tier,
                            requiredTier: minimumTier,
                            upgradeUrl: '/pricing',
                        },
                    },
                    meta: { timestamp: new Date().toISOString() },
                });
                return;
            }
            req.userTier = subscription.tier;
            req.tierInfo = {
                tier: subscription.tier,
                limits: subscription_2.TIER_LIMITS[subscription.tier],
            };
            next();
        }
        catch (error) {
            console.error('[TierCheck Middleware] Error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to verify subscription tier',
                },
                meta: { timestamp: new Date().toISOString() },
            });
        }
    };
}
async function checkItemLimit(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
                meta: { timestamp: new Date().toISOString() },
            });
            return;
        }
        const items = await (0, db_1.getAllItems)(userId);
        const check = await (0, subscription_1.canAddItems)(userId, items.length);
        if (!check.allowed) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'ITEM_LIMIT_REACHED',
                    message: `You've reached the free tier limit of ${items.length} items`,
                    details: {
                        currentItems: items.length,
                        maxItems: items.length + check.remaining,
                        upgradeUrl: '/pricing',
                        upgradeMessage: 'Upgrade to Pro for unlimited items',
                    },
                },
                meta: { timestamp: new Date().toISOString() },
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error('[ItemLimit Middleware] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to check item limit',
            },
            meta: { timestamp: new Date().toISOString() },
        });
    }
}
async function trackReceiptScan(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            next();
            return;
        }
        const check = await (0, subscription_1.canScanReceipt)(userId);
        if (!check.allowed) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'RECEIPT_SCAN_LIMIT_REACHED',
                    message: `You've reached your monthly receipt scan limit`,
                    details: {
                        remaining: 0,
                        upgradeUrl: '/pricing',
                        upgradeMessage: 'Upgrade to Pro for unlimited receipt scans',
                    },
                },
                meta: { timestamp: new Date().toISOString() },
            });
            return;
        }
        (0, subscription_1.incrementUsage)(userId, 'receiptScans');
        next();
    }
    catch (error) {
        console.error('[ReceiptScan Middleware] Error:', error);
        next();
    }
}
async function checkVoiceAssistantAccess(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
                meta: { timestamp: new Date().toISOString() },
            });
            return;
        }
        if (!(await (0, subscription_1.canUseVoiceAssistant)(userId))) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'VOICE_ASSISTANT_PRO_REQUIRED',
                    message: 'Voice assistant is a Pro feature',
                    details: {
                        upgradeUrl: '/pricing',
                        upgradeMessage: 'Upgrade to Pro for voice assistant access',
                    },
                },
                meta: { timestamp: new Date().toISOString() },
            });
            return;
        }
        (0, subscription_1.incrementUsage)(userId, 'voiceSessions');
        next();
    }
    catch (error) {
        console.error('[VoiceAssistant Middleware] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to check voice assistant access',
            },
            meta: { timestamp: new Date().toISOString() },
        });
    }
}
function trackVoiceSession(userId) {
    try {
        (0, subscription_1.incrementUsage)(userId, 'voiceSessions');
    }
    catch (error) {
        console.error('[VoiceSession Tracking] Error:', error);
    }
}
//# sourceMappingURL=tierCheck.js.map