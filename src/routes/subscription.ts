/**
 * Subscription API Routes
 * Endpoints for managing subscriptions, checkout, and tier info
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getUserTierInfo,
  canAddItems,
  canScanReceipt,
  canUseVoiceAssistant,
} from '../services/subscription';
import { createCheckoutSession, createCustomerPortalSession, getPriceIds } from '../services/stripe';
import { getAllItems } from '../db';
import { ApiResponse } from '../models/types';
import { CreateCheckoutRequest } from '../models/subscription';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// Helper Functions
// ============================================================================

function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
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

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/subscription/tier
 * Get current user's tier info, limits, and usage
 */
router.get('/tier', (req, res) => {
  try {
    const userId = req.userId!;
    const items = getAllItems(userId);
    const tierInfo = getUserTierInfo(userId, items.length);

    res.json(successResponse(tierInfo));
  } catch (error) {
    console.error('[GET /subscription/tier] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve tier information')
    );
  }
});

/**
 * GET /api/subscription/check-items
 * Check if user can add items (returns remaining count)
 */
router.get('/check-items', (req, res) => {
  try {
    const userId = req.userId!;
    const items = getAllItems(userId);
    const check = canAddItems(userId, items.length);

    res.json(
      successResponse({
        canAdd: check.allowed,
        currentItems: items.length,
        maxItems: check.remaining + items.length,
        remaining: check.remaining,
      })
    );
  } catch (error) {
    console.error('[GET /subscription/check-items] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to check item limits')
    );
  }
});

/**
 * GET /api/subscription/check-receipt
 * Check if user can scan receipts
 */
router.get('/check-receipt', (req, res) => {
  try {
    const userId = req.userId!;
    const check = canScanReceipt(userId);

    res.json(
      successResponse({
        canScan: check.allowed,
        remaining: check.remaining,
      })
    );
  } catch (error) {
    console.error('[GET /subscription/check-receipt] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to check receipt scan limits')
    );
  }
});

/**
 * GET /api/subscription/check-voice
 * Check if user can use voice assistant
 */
router.get('/check-voice', (req, res) => {
  try {
    const userId = req.userId!;
    const allowed = canUseVoiceAssistant(userId);

    res.json(
      successResponse({
        canUse: allowed,
      })
    );
  } catch (error) {
    console.error('[GET /subscription/check-voice] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to check voice assistant access')
    );
  }
});

/**
 * GET /api/subscription/prices
 * Get Stripe price IDs for client
 */
router.get('/prices', (_req, res) => {
  try {
    const prices = getPriceIds();
    res.json(successResponse(prices));
  } catch (error) {
    console.error('[GET /subscription/prices] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve pricing information')
    );
  }
});

/**
 * POST /api/subscription/checkout
 * Create a checkout session for subscription upgrade
 */
router.post('/checkout', async (req, res) => {
  try {
    const userId = req.userId!;
    const { tier, billingInterval, successUrl, cancelUrl } = req.body as CreateCheckoutRequest;

    // Validate inputs
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

    const checkout = await createCheckoutSession({
      userId,
      tier,
      billingInterval,
      successUrl,
      cancelUrl,
    });

    res.json(successResponse(checkout));
  } catch (error) {
    console.error('[POST /subscription/checkout] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create checkout session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

/**
 * POST /api/subscription/portal
 * Create a customer portal session for managing subscription
 */
router.post('/portal', async (req, res) => {
  try {
    const userId = req.userId!;
    const { returnUrl } = req.body;

    if (!returnUrl) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing returnUrl'));
      return;
    }

    const portal = await createCustomerPortalSession(userId, returnUrl);

    res.json(successResponse(portal));
  } catch (error) {
    console.error('[POST /subscription/portal] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create portal session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

/**
 * GET /api/subscription/status
 * Simple endpoint to check if subscription is active
 */
router.get('/status', (req, res) => {
  try {
    const userId = req.userId!;
    const items = getAllItems(userId);
    const tierInfo = getUserTierInfo(userId, items.length);

    res.json(
      successResponse({
        tier: tierInfo.tier,
        isPaid: tierInfo.tier !== 'free',
        isActive: tierInfo.subscription?.status === 'active',
        subscriptionStatus: tierInfo.subscription?.status || null,
      })
    );
  } catch (error) {
    console.error('[GET /subscription/status] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve subscription status')
    );
  }
});

export default router;
