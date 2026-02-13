/**
 * Pantry Items API Routes
 * RESTful endpoints for CRUD operations on pantry inventory
 * All routes require authentication
 */

import { Router } from 'express';
import {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
} from '../db';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../models/types';
import {
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
} from '../models/validation';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// Helper Functions
// ============================================================================

function successResponse<T>(data: T, userId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(userId && { userId }),
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
 * GET /api/items
 * List all pantry items for the authenticated user with optional category filter
 */
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const userId = req.userId!;
    
    const items = await getAllItems(userId, category as string | undefined);

    res.json(successResponse(items, userId));
  } catch (error) {
    console.error('[GET /items] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve items')
    );
  }
});

/**
 * GET /api/items/categories
 * Get all unique categories for the authenticated user
 */
router.get('/categories', async (req, res) => {
  try {
    const userId = req.userId!;
    const categories = await getCategories(userId);
    res.json(successResponse(categories));
  } catch (error) {
    console.error('[GET /items/categories] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve categories')
    );
  }
});

/**
 * GET /api/items/:id
 * Get a specific item by ID for the authenticated user
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = itemIdSchema.safeParse({ id: req.params.id });

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const item = await getItemById(userId, req.params.id);

    if (!item) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`)
      );
      return;
    }

    res.json(successResponse(item));
  } catch (error) {
    console.error('[GET /items/:id] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve item')
    );
  }
});

/**
 * POST /api/items
 * Create a new pantry item for the authenticated user
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = createItemSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const newItem = await createItem(userId, validation.data);

    res.status(201).json(successResponse(newItem, userId));
  } catch (error) {
    console.error('[POST /items] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create item')
    );
  }
});

/**
 * PUT /api/items/:id
 * Update an existing pantry item for the authenticated user
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const itemId = req.params.id;
    
    // DEBUG: Log incoming request details
    console.log(`[PUT /api/items/:id] Request received:`, {
      itemId,
      userId,
      body: req.body,
      contentType: req.headers['content-type'],
    });
    
    // Validate ID
    const idValidation = itemIdSchema.safeParse({ id: itemId });
    if (!idValidation.success) {
      console.log(`[PUT /api/items/:id] ID validation failed:`, idValidation.error.errors);
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format')
      );
      return;
    }

    // Validate body (needs at least one field)
    const bodyValidation = updateItemSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      console.log(`[PUT /api/items/:id] Body validation failed:`, bodyValidation.error.errors);
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    // Check if any fields were provided
    if (Object.keys(req.body).length === 0) {
      console.log(`[PUT /api/items/:id] Empty body rejected`);
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'At least one field must be provided for update')
      );
      return;
    }

    console.log(`[PUT /api/items/:id] Calling updateItem with:`, {
      userId,
      itemId,
      data: bodyValidation.data,
    });

    const updatedItem = await updateItem(userId, itemId, bodyValidation.data);

    // DEBUG: Log result
    console.log(`[PUT /api/items/:id] updateItem result:`, updatedItem);

    if (!updatedItem) {
      console.log(`[PUT /api/items/:id] Item not found or update failed for id=${itemId}`);
      res.status(404).json(
        errorResponse('NOT_FOUND', `Item with ID ${itemId} not found`)
      );
      return;
    }

    console.log(`[PUT /api/items/:id] Success - returning updated item:`, updatedItem);
    res.json(successResponse(updatedItem));
  } catch (error) {
    console.error('[PUT /items/:id] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to update item')
    );
  }
});

/**
 * DELETE /api/items/:id
 * Delete a pantry item for the authenticated user
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = itemIdSchema.safeParse({ id: req.params.id });

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format')
      );
      return;
    }

    const deleted = await deleteItem(userId, req.params.id);

    if (!deleted) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`)
      );
      return;
    }

    res.json(successResponse({ deleted: true, id: req.params.id }));
  } catch (error) {
    console.error('[DELETE /items/:id] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to delete item')
    );
  }
});

export default router;
