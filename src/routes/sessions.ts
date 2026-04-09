/**
 * Session API Routes (REMY-285)
 * Shopping session endpoints for session management and running total
 * Routes: POST /sessions, GET /sessions/:id, PATCH /sessions/:id,
 *         POST /sessions/:id/capture, GET /sessions/:id/receipts
 */

import { Router } from 'express';
import { getDatabase } from '../db';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../models/types';
import { SessionItem } from '../models/shoppingSession';
import {
  createSessionSchema,
  sessionIdSchema,
  updateSessionSchema,
  captureReceiptSchema,
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

/**
 * Calculate running total from session items
 */
function calculateRunningTotal(items: SessionItem[]): number {
  return items.reduce((total, item) => {
    const price = item.price || 0;
    return total + price * item.quantity;
  }, 0);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /sessions
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

    const db = getDatabase();
    const session = await db.createSession(userId, validation.data);

    res.status(201).json(successResponse(session));
  } catch (error) {
    console.error('[POST /sessions] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create shopping session')
    );
  }
});

/**
 * GET /sessions/:id
 * Get a session with running total and all items
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

    const db = getDatabase();
    const session = await db.getSessionById(userId, sessionId);

    if (!session) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Shopping session with ID ${sessionId} not found`)
      );
      return;
    }

    // Calculate running total from items
    const runningTotal = calculateRunningTotal(session.items);

    res.json(
      successResponse({
        ...session,
        runningTotal,
      })
    );
  } catch (error) {
    console.error('[GET /sessions/:id] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping session')
    );
  }
});

/**
 * GET /sessions
 * List user's shopping sessions
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const db = getDatabase();

    const sessions = await db.getUserSessions(userId, 100, 0);

    res.json(successResponse(sessions));
  } catch (error) {
    console.error('[GET /sessions] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping sessions')
    );
  }
});

/**
 * PATCH /sessions/:id
 * Update session (add items, update quantities, notes, storeName)
 */
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const bodyValidation = updateSessionSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    const db = getDatabase();

    // Verify session exists and belongs to user
    const existingSession = await db.getSessionById(userId, sessionId);
    if (!existingSession) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found or not active')
      );
      return;
    }

    // Handle items update if provided
    if (bodyValidation.data.items && bodyValidation.data.items.length > 0) {
      // Add items to session
      for (const item of bodyValidation.data.items) {
        await db.addSessionItem(userId, sessionId, {
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit,
          price: item.price,
          category: item.category,
        });
      }
    }

    // Return updated session
    const updatedSession = await db.getSessionById(userId, sessionId);
    if (!updatedSession) {
      res.status(500).json(
        errorResponse('INTERNAL_ERROR', 'Failed to retrieve updated session')
      );
      return;
    }

    const runningTotal = calculateRunningTotal(updatedSession.items);

    res.json(
      successResponse({
        ...updatedSession,
        runningTotal,
      })
    );
  } catch (error: any) {
    console.error('[PATCH /sessions/:id] Error:', error);

    if (error.message?.includes('Session not found')) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found')
      );
      return;
    }

    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to update shopping session')
    );
  }
});

/**
 * POST /sessions/:id/capture
 * Capture receipt image for a session
 */
router.post('/:id/capture', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const bodyValidation = captureReceiptSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    const db = getDatabase();

    // Verify session exists
    const session = await db.getSessionById(userId, sessionId);
    if (!session) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found')
      );
      return;
    }

    // Capture receipt using adapter method
    const receipt = await db.captureSessionReceipt(
      userId,
      sessionId,
      bodyValidation.data.imageData,
      bodyValidation.data.mimeType,
      bodyValidation.data.notes
    );

    res.status(201).json(successResponse(receipt));
  } catch (error) {
    console.error('[POST /sessions/:id/capture] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to capture receipt')
    );
  }
});

/**
 * GET /sessions/:id/receipts
 * List captured receipts for a session
 */
router.get('/:id/receipts', async (req, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id;

    const idValidation = sessionIdSchema.safeParse({ id: sessionId });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid session ID format')
      );
      return;
    }

    const db = getDatabase();

    // Verify session exists
    const session = await db.getSessionById(userId, sessionId);
    if (!session) {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Shopping session not found')
      );
      return;
    }

    const receipts = await db.getSessionReceipts(userId, sessionId);

    res.json(successResponse(receipts));
  } catch (error) {
    console.error('[GET /sessions/:id/receipts] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve receipts')
    );
  }
});

export default router;
