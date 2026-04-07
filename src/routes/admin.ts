/**
 * Admin API Routes
 * Dashboard metrics, transaction history, and alerts
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getDashboardMetrics,
  getTransactions,
  getFailedPaymentAlerts,
} from '../db/admin';
import { ApiResponse } from '../models/types';

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
 * GET /api/admin/dashboard?period=7d
 * Get comprehensive dashboard metrics
 * Period can be: 7d, 30d, 90d
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get period from query, default to 7d
    const periodParam = req.query.period as string;
    const period: '7d' | '30d' | '90d' = ['7d', '30d', '90d'].includes(periodParam)
      ? (periodParam as '7d' | '30d' | '90d')
      : '7d';

    const metrics = await getDashboardMetrics(period);

    res.json(successResponse(metrics));
  } catch (error) {
    console.error('[GET /admin/dashboard] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve dashboard metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

/**
 * GET /api/admin/transactions?limit=10&cursor=...
 * Get paginated transaction history
 */
router.get('/transactions', async (req, res) => {
  try {
    // Parse limit, default to 10, max 100
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = isNaN(limitParam) || limitParam < 1
      ? 10
      : Math.min(limitParam, 100);

    const cursor = req.query.cursor as string | undefined;

    const result = await getTransactions(limit, cursor);

    res.json(successResponse(result));
  } catch (error) {
    console.error('[GET /admin/transactions] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve transactions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

/**
 * GET /api/admin/alerts
 * Get failed payment alerts and other system warnings
 */
router.get('/alerts', async (_req, res) => {
  try {
    const alerts = await getFailedPaymentAlerts();

    res.json(successResponse(alerts));
  } catch (error) {
    console.error('[GET /admin/alerts] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
});

export default router;
