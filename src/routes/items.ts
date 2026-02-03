/**
 * Pantry Items API Routes
 * RESTful endpoints for CRUD operations on pantry inventory
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
import { ApiResponse } from '../models/types';
import {
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
} from '../models/validation';

const router = Router();

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
 * List all pantry items with optional category filter
 */
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    const items = getAllItems(category as string | undefined);

    res.json(successResponse(items));
  } catch (error) {
    console.error('[GET /items] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve items')
    );
  }
});

/**
 * GET /api/items/categories
 * Get all unique categories
 */
router.get('/categories', (_req, res) => {
  try {
    const categories = getCategories();
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
 * Get a specific item by ID
 */
router.get('/:id', (req, res) => {
  try {
    const validation = itemIdSchema.safeParse({ id: req.params.id });

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const item = getItemById(req.params.id);

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
 * Create a new pantry item
 */
router.post('/', (req, res) => {
  try {
    const validation = createItemSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const newItem = createItem(validation.data);

    res.status(201).json(successResponse(newItem));
  } catch (error) {
    console.error('[POST /items] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create item')
    );
  }
});

/**
 * PUT /api/items/:id
 * Update an existing pantry item
 */
router.put('/:id', (req, res) => {
  try {
    // Validate ID
    const idValidation = itemIdSchema.safeParse({ id: req.params.id });
    if (!idValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format')
      );
      return;
    }

    // Validate body (needs at least one field)
    const bodyValidation = updateItemSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: bodyValidation.error.errors,
        })
      );
      return;
    }

    // Check if any fields were provided
    if (Object.keys(req.body).length === 0) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'At least one field must be provided for update')
      );
      return;
    }

    const updatedItem = updateItem(req.params.id, bodyValidation.data);

    if (!updatedItem) {
      res.status(404).json(
        errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`)
      );
      return;
    }

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
 * Delete a pantry item
 */
router.delete('/:id', (req, res) => {
  try {
    const validation = itemIdSchema.safeParse({ id: req.params.id });

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid item ID format')
      );
      return;
    }

    const deleted = deleteItem(req.params.id);

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