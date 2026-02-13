"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../models/validation");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
function successResponse(data, userId) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            ...(userId && { userId }),
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
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const userId = req.userId;
        const items = await (0, db_1.getAllItems)(userId, category);
        res.json(successResponse(items, userId));
    }
    catch (error) {
        console.error('[GET /items] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve items'));
    }
});
router.get('/categories', async (req, res) => {
    try {
        const userId = req.userId;
        const categories = await (0, db_1.getCategories)(userId);
        res.json(successResponse(categories));
    }
    catch (error) {
        console.error('[GET /items/categories] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve categories'));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const validation = validation_1.itemIdSchema.safeParse({ id: req.params.id });
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format', {
                errors: validation.error.errors,
            }));
            return;
        }
        const item = await (0, db_1.getItemById)(userId, req.params.id);
        if (!item) {
            res.status(404).json(errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`));
            return;
        }
        res.json(successResponse(item));
    }
    catch (error) {
        console.error('[GET /items/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve item'));
    }
});
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const validation = validation_1.createItemSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const newItem = await (0, db_1.createItem)(userId, validation.data);
        res.status(201).json(successResponse(newItem, userId));
    }
    catch (error) {
        console.error('[POST /items] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create item'));
    }
});
router.put('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const itemId = req.params.id;
        console.log(`[PUT /api/items/:id] Request received:`, {
            itemId,
            userId,
            body: req.body,
            contentType: req.headers['content-type'],
        });
        const idValidation = validation_1.itemIdSchema.safeParse({ id: itemId });
        if (!idValidation.success) {
            console.log(`[PUT /api/items/:id] ID validation failed:`, idValidation.error.errors);
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format'));
            return;
        }
        const bodyValidation = validation_1.updateItemSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            console.log(`[PUT /api/items/:id] Body validation failed:`, bodyValidation.error.errors);
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        if (Object.keys(req.body).length === 0) {
            console.log(`[PUT /api/items/:id] Empty body rejected`);
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'At least one field must be provided for update'));
            return;
        }
        console.log(`[PUT /api/items/:id] Calling updateItem with:`, {
            userId,
            itemId,
            data: bodyValidation.data,
        });
        const updatedItem = await (0, db_1.updateItem)(userId, itemId, bodyValidation.data);
        console.log(`[PUT /api/items/:id] updateItem result:`, updatedItem);
        if (!updatedItem) {
            console.log(`[PUT /api/items/:id] Item not found or update failed for id=${itemId}`);
            res.status(404).json(errorResponse('NOT_FOUND', `Item with ID ${itemId} not found`));
            return;
        }
        console.log(`[PUT /api/items/:id] Success - returning updated item:`, updatedItem);
        res.json(successResponse(updatedItem));
    }
    catch (error) {
        console.error('[PUT /items/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update item'));
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const validation = validation_1.itemIdSchema.safeParse({ id: req.params.id });
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format'));
            return;
        }
        const deleted = await (0, db_1.deleteItem)(userId, req.params.id);
        if (!deleted) {
            res.status(404).json(errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`));
            return;
        }
        res.json(successResponse({ deleted: true, id: req.params.id }));
    }
    catch (error) {
        console.error('[DELETE /items/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete item'));
    }
});
exports.default = router;
//# sourceMappingURL=items.js.map