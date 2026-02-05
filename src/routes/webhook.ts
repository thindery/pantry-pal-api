/**
 * Stripe Webhook Routes
 * Handles Stripe webhook events for subscription management
 */

import { Router, raw } from 'express';
import { handleWebhookEvent } from '../services/stripe';

const router = Router();

// ============================================================================
// Stripe Webhook Endpoint
// ============================================================================

/**
 * POST /api/webhooks/stripe
 * Receive and process Stripe webhook events
 * 
 * Note: This endpoint must use raw body parsing (not JSON)
 * because Stripe requires the raw payload for signature verification
 */
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const payload = req.body;
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({
          received: false,
          error: 'Missing stripe-signature header',
        });
        return;
      }

      const result = await handleWebhookEvent(payload, signature);

      if (result.received) {
        res.json({ received: true });
      } else {
        res.status(400).json({ received: false });
      }
    } catch (error) {
      console.error('[Webhook] Error processing webhook:', error);
      res.status(400).json({
        received: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      });
    }
  }
);

export default router;
