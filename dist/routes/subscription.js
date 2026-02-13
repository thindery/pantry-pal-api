"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../services/subscription");
const stripe_1 = require("../services/stripe");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
function successResponse(data) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}
function errorResponse(code, message, details) {
    return {
        success: false,
        error: {
            code,
            message,
            details,
        },
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}
router.get('/tier', async (req, res) => {
    try {
        const userId = req.userId;
        const items = await (0, db_1.getAllItems)(userId);
        const tierInfo = await (0, subscription_1.getUserTierInfo)(userId, items.length);
        res.json(successResponse(tierInfo));
    }
    catch (error) {
        console.error('[GET /subscription/tier] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve tier information'));
    }
});
router.get('/check-items', async (req, res) => {
    try {
        const userId = req.userId;
        const items = await (0, db_1.getAllItems)(userId);
        const check = await (0, subscription_1.canAddItems)(userId, items.length);
        res.json(successResponse({
            canAdd: check.allowed,
            currentItems: items.length,
            maxItems: check.remaining + items.length,
            remaining: check.remaining,
        }));
    }
    catch (error) {
        console.error('[GET /subscription/check-items] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check item limits'));
    }
});
router.get('/check-receipt', async (req, res) => {
    try {
        const userId = req.userId;
        const check = await (0, subscription_1.canScanReceipt)(userId);
        res.json(successResponse({
            canScan: check.allowed,
            remaining: check.remaining,
        }));
    }
    catch (error) {
        console.error('[GET /subscription/check-receipt] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check receipt scan limits'));
    }
});
router.get('/check-voice', async (req, res) => {
    try {
        const userId = req.userId;
        const allowed = await (0, subscription_1.canUseVoiceAssistant)(userId);
        res.json(successResponse({
            canUse: allowed,
        }));
    }
    catch (error) {
        console.error('[GET /subscription/check-voice] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check voice assistant access'));
    }
});
router.get('/prices', (_req, res) => {
    try {
        const prices = (0, stripe_1.getPriceIds)();
        res.json(successResponse(prices));
    }
    catch (error) {
        console.error('[GET /subscription/prices] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve pricing information'));
    }
});
router.post('/checkout', async (req, res) => {
    try {
        const userId = req.userId;
        const { tier, billingInterval, successUrl, cancelUrl } = req.body;
        if (!tier || !['pro', 'family'].includes(tier)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid tier. Must be "pro" or "family"'));
            return;
        }
        if (!billingInterval || !['month', 'year'].includes(billingInterval)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid billing interval. Must be "month" or "year"'));
            return;
        }
        if (!successUrl || !cancelUrl) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing successUrl or cancelUrl'));
            return;
        }
        const checkout = await (0, stripe_1.createCheckoutSession)({
            userId,
            tier,
            billingInterval,
            successUrl,
            cancelUrl,
        });
        res.json(successResponse(checkout));
    }
    catch (error) {
        console.error('[POST /subscription/checkout] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create checkout session', {
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});
router.post('/portal', async (req, res) => {
    try {
        const userId = req.userId;
        const { returnUrl } = req.body;
        if (!returnUrl) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing returnUrl'));
            return;
        }
        const portal = await (0, stripe_1.createCustomerPortalSession)(userId, returnUrl);
        res.json(successResponse(portal));
    }
    catch (error) {
        console.error('[POST /subscription/portal] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create portal session', {
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});
router.get('/status', async (req, res) => {
    try {
        const userId = req.userId;
        const items = await (0, db_1.getAllItems)(userId);
        const tierInfo = await (0, subscription_1.getUserTierInfo)(userId, items.length);
        res.json(successResponse({
            tier: tierInfo.tier,
            isPaid: tierInfo.tier !== 'free',
            isActive: tierInfo.subscription?.status === 'active',
            subscriptionStatus: tierInfo.subscription?.status || null,
        }));
    }
    catch (error) {
        console.error('[GET /subscription/status] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve subscription status'));
    }
});
exports.default = router;
//# sourceMappingURL=subscription.js.map