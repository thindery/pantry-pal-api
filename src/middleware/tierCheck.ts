/**
 * Tier checking middleware for feature gating
 * Validates user subscription tier before allowing access to premium features
 */

import { Request, Response, NextFunction } from 'express';
import {
  getOrCreateUserSubscription,
  canAddItems,
  canScanReceipt,
  canUseVoiceAssistant,
  incrementUsage,
} from '../services/subscription';
import { TIER_LIMITS, UserTier } from '../models/subscription';
import { getAllItems } from '../db';

// Extend Express Request to include tier info
declare global {
  namespace Express {
    interface Request {
      userTier?: UserTier;
      tierInfo?: {
        tier: UserTier;
        limits: typeof TIER_LIMITS.free;
      };
    }
  }
}

/**
 * Middleware to require a minimum tier level
 * @param minimumTier - The minimum tier required ('free', 'pro', or 'family')
 */
export function requireTier(minimumTier: UserTier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const subscription = getOrCreateUserSubscription(userId);
      const tierLevels: Record<UserTier, number> = { free: 0, pro: 1, family: 2 };

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

      // Attach tier info to request
      req.userTier = subscription.tier;
      req.tierInfo = {
        tier: subscription.tier,
        limits: TIER_LIMITS[subscription.tier],
      };

      next();
    } catch (error) {
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

/**
 * Middleware to check item limit before allowing creation
 * Returns 403 with upgrade prompt if at limit
 */
export function checkItemLimit(req: Request, res: Response, next: NextFunction): void {
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

    const items = getAllItems(userId);
    const check = canAddItems(userId, items.length);

    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ITEM_LIMIT_REACHED',
          message: `You've reached the free tier limit of ${items.length} items`,
          details: {
            currentItems: items.length,
            maxItems: items.length,
            upgradeUrl: '/pricing',
            upgradeMessage: 'Upgrade to Pro for unlimited items',
          },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    next();
  } catch (error) {
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

/**
 * Middleware to track and check receipt scan usage
 */
export function trackReceiptScan(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = req.userId;

    if (!userId) {
      next();
      return;
    }

    // Check first
    const check = canScanReceipt(userId);

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

    // Increment usage
    incrementUsage(userId, 'receiptScans');

    next();
  } catch (error) {
    console.error('[ReceiptScan Middleware] Error:', error);
    // Don't block on tracking errors
    next();
  }
}

/**
 * Middleware to check voice assistant access
 */
export function checkVoiceAssistantAccess(req: Request, res: Response, next: NextFunction): void {
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

    if (!canUseVoiceAssistant(userId)) {
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

    // Track voice session
    incrementUsage(userId, 'voiceSessions');

    next();
  } catch (error) {
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

/**
 * Voice session tracking (after successful use)
 */
export function trackVoiceSession(userId: string): void {
  try {
    incrementUsage(userId, 'voiceSessions');
  } catch (error) {
    console.error('[VoiceSession Tracking] Error:', error);
  }
}
