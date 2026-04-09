/**
 * Shopping Session API Routes
 * Endpoints for shopping session mode (cart/receipt scanner functionality)
 * Ticket: REMY-285
 */

import { Router } from 'express';
import {
  createSession,
  getSessionById,
  getUserSessions,
  getSessionCount,
  addSessionItem,
  removeSessionItem,
  completeSession,
  cancelSession,
  addSessionToInventory,
} from '../db/operations';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../models/types';
import {
  createSessionSchema,
  addSessionItemSchema,
  completeSessionSchema,
  sessionIdSchema,
  sessionItemIdSchema,
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
 * GET /api/shopping-sessions
 * List user's shopping sessions with pagination
 * Query params: page, limit, status (active|completed|cancelled)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const pagination = paginationSchema.safeParse(req.query);
    const { status } = req.query as { status?: string };

    const page = pagination.success ? pagination.data.page : 1;
    const limit = pagination.success ? pagination.data.limit : 20;
    const offset = (page - 1) * limit;

    const sessions = await getUserSessions(userId, limit, offset, status);
    const total = await getSessionCount(userId, status);

    res.json(
      successResponse(sessions, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        status: status || 'all',
      })
    );
  } catch (error) {
    console.error('[GET /shopping-sessions] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping sessions')
    );
  }
});

/**
 * POST /api/shopping-sessions
 * Create a new shopping session
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = createSessionSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const session = await createSession(userId, validation.data);

    res.status(201).json(successResponse(session));
  } catch (error) {
    console.error('[POST /shopping-sessions] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create shopping session')
    );
  }
});

/**
 * GET /api/shopping-sessions/:id
 * Get a specific session with all items and running total
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    const validation = sessionIdSchema.safeParse({ id: sessionId });
    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const session = await getSessionById(userId, sessionId);

    if (!session) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Shopping session with ID ${sessionId} not found`)
      );
      return;
    }

    res.json(successResponse(session));
  } catch (error) {
    console.error('[GET /shopping-sessions/:id] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping session')
    );
  }
});

/**
 * POST /api/shopping-sessions/:id/items
 * Add an item to a shopping session
 */
router.post('/:id/items', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    // Validate session ID
    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    // Validate request body
    const bodyValidation = addSessionItemSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    const item = await addSessionItem(userId, sessionId, bodyValidation.data);

    res.status(201).json(successResponse(item));
  } catch (error: any) {
    console.error('[POST /shopping-sessions/:id/items] Error:', error);
    
    if (error.message?.includes('Session not found or not active')) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found or not active')
      );
      return;
    }
    
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to add item to session')
    );
  }
});

/**
 * DELETE /api/shopping-sessions/:id/items/:itemId
 * Remove an item from a shopping session
 */
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;
    const itemId = req.params.itemId;

    // Validate IDs
    const sessionValidation = sessionIdSchema.safeParse({ id: sessionId });
    const itemValidation = sessionItemIdSchema.safeParse({ itemId });
    
    if (!sessionValidation.success || !itemValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid ID format')
      );
      return;
    }

    const deleted = await removeSessionItem(userId, sessionId, itemId);

    if (!deleted) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Item not found in session')
      );
      return;
    }

    res.json(successResponse({ deleted: true, itemId }));
  } catch (error) {
    console.error('[DELETE /shopping-sessions/:id/items/:itemId] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to remove item from session')
    );
  }
});

/**
 * POST /api/shopping-sessions/:id/complete
 * Complete a shopping session
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    // Validate session ID
    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    // Validate request body (optional fields)
    const bodyValidation = completeSessionSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    const session = await completeSession(userId, sessionId, bodyValidation.data);

    if (!session) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found or not active')
      );
      return;
    }

    res.json(successResponse(session));
  } catch (error) {
    console.error('[POST /shopping-sessions/:id/complete] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to complete shopping session')
    );
  }
});

/**
 * POST /api/shopping-sessions/:id/cancel
 * Cancel a shopping session
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    // Validate session ID
    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const cancelled = await cancelSession(userId, sessionId);

    if (!cancelled) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found or not active')
      );
      return;
    }

    res.json(successResponse({ cancelled: true, sessionId }));
  } catch (error) {
    console.error('[POST /shopping-sessions/:id/cancel] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to cancel shopping session')
    );
  }
});

/**
 * POST /api/shopping-sessions/:id/add-to-inventory
 * Add all items from a completed shopping session to pantry inventory
 * Only items with barcodes are added to inventory
 * Logs ADD activity for each item
 */
router.post('/:id/add-to-inventory', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    // Validate session ID
    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const result = await addSessionToInventory(userId, sessionId);

    res.json(successResponse(result, {
      itemsAdded: result.items.length,
      activitiesLogged: result.activities.length,
    }));
  } catch (error: any) {
    console.error('[POST /shopping-sessions/:id/add-to-inventory] Error:', error);

    if (error.message?.includes('Session not found')) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found')
      );
      return;
    }

    if (error.message?.includes('Session must be completed')) {
      res.status(400).json(
        errorResponse('INVALID_STATE', 'Session must be completed before adding to inventory')
      );
      return;
    }

    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to add session items to inventory')
    );
  }
});

export default router;
