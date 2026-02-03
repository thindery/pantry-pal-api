"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const validation_1 = require("../models/validation");
const router = (0, express_1.Router)();
function successResponse(data) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
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
router.get('/', (req, res) => {
    try {
        const { category } = req.query;
        const items = (0, db_1.getAllItems)(category);
        res.json(successResponse(items));
    }
    catch (error) {
        console.error('[GET /items] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve items'));
    }
});
router.get('/categories', (_req, res) => {
    try {
        const categories = (0, db_1.getCategories)();
        res.json(successResponse(categories));
    }
    catch (error) {
        console.error('[GET /items/categories] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve categories'));
    }
});
router.get('/:id', (req, res) => {
    try {
        const validation = validation_1.itemIdSchema.safeParse({ id: req.params.id });
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format', {
                errors: validation.error.errors,
            }));
            return;
        }
        const item = (0, db_1.getItemById)(req.params.id);
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
router.post('/', (req, res) => {
    try {
        const validation = validation_1.createItemSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const newItem = (0, db_1.createItem)(validation.data);
        res.status(201).json(successResponse(newItem));
    }
    catch (error) {
        console.error('[POST /items] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create item'));
    }
});
router.put('/:id', (req, res) => {
    try {
        const idValidation = validation_1.itemIdSchema.safeParse({ id: req.params.id });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format'));
            return;
        }
        const bodyValidation = validation_1.updateItemSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        if (Object.keys(req.body).length === 0) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'At least one field must be provided for update'));
            return;
        }
        const updatedItem = (0, db_1.updateItem)(req.params.id, bodyValidation.data);
        if (!updatedItem) {
            res.status(404).json(errorResponse('NOT_FOUND', `Item with ID ${req.params.id} not found`));
            return;
        }
        res.json(successResponse(updatedItem));
    }
    catch (error) {
        console.error('[PUT /items/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update item'));
    }
});
router.delete('/:id', (req, res) => {
    try {
        const validation = validation_1.itemIdSchema.safeParse({ id: req.params.id });
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid item ID format'));
            return;
        }
        const deleted = (0, db_1.deleteItem)(req.params.id);
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