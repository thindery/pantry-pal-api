/**
 * Activity API Routes
 * Endpoints for logging and retrieving inventory change activities
 * All routes require authentication
 */

import { Router } from 'express';
import {
  getActivities,
  getActivityCount,
  logActivity,
} from '../db';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../models/types';
import {
  createActivitySchema,
  itemIdSchema,
  paginationSchema,
} from '../models/validation';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// Helper Functions
// ============================================================================

function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

function errorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse<never> {
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
 * GET /api/activities
 * List recent activity for the authenticated user with pagination
 * Query params: page, limit, itemId
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const pagination = paginationSchema.safeParse(req.query);
    const { itemId } = req.query as { itemId?: string };

    if (itemId) {
      const idValidation = itemIdSchema.safeParse({ id: itemId });
      if (!idValidation.success) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Invalid itemId format')
        );
        return;
      }
    }

    const page = pagination.success ? pagination.data.page : 1;
    const limit = pagination.success ? pagination.data.limit : 20;
    const offset = (page - 1) * limit;

    const activities = await getActivities(userId, limit, offset, itemId);
    const total = await getActivityCount(userId, itemId);

    res.json(
      successResponse(activities, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    console.error('[GET /activities] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve activities')
    );
  }
});

/**
 * POST /api/activities
 * Log a new activity for the authenticated user (ADD, REMOVE, or ADJUST)
 * Automatically updates the associated item's quantity
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = createActivitySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const { itemId, type, amount, source } = validation.data;

    const activity = await logActivity(userId, itemId, type, amount, source);

    if (!activity) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Item with ID ${itemId} not found`)
      );
      return;
    }

    res.status(201).json(successResponse(activity));
  } catch (error) {
    console.error('[POST /activities] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to log activity')
    );
  }
});

export default router;
