"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const operations_1 = require("../db/operations");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../models/validation");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
function successResponse(data, meta) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta,
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
        const userId = req.userId;
        const pagination = validation_1.paginationSchema.safeParse(req.query);
        const { status } = req.query;
        const page = pagination.success ? pagination.data.page : 1;
        const limit = pagination.success ? pagination.data.limit : 20;
        const offset = (page - 1) * limit;
        const sessions = await (0, operations_1.getUserSessions)(userId, limit, offset, status);
        const total = await (0, operations_1.getSessionCount)(userId, status);
        res.json(successResponse(sessions, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            status: status || 'all',
        }));
    }
    catch (error) {
        console.error('[GET /shopping-sessions] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping sessions'));
    }
});
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const validation = validation_1.createSessionSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const session = await (0, operations_1.createSession)(userId, validation.data);
        res.status(201).json(successResponse(session));
    }
    catch (error) {
        console.error('[POST /shopping-sessions] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create shopping session'));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const validation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const session = await (0, operations_1.getSessionById)(userId, sessionId);
        if (!session) {
            res.status(404).json(errorResponse('NOT_FOUND', `Shopping session with ID ${sessionId} not found`));
            return;
        }
        res.json(successResponse(session));
    }
    catch (error) {
        console.error('[GET /shopping-sessions/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping session'));
    }
});
router.post('/:id/items', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const bodyValidation = validation_1.addSessionItemSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        const item = await (0, operations_1.addSessionItem)(userId, sessionId, bodyValidation.data);
        res.status(201).json(successResponse(item));
    }
    catch (error) {
        console.error('[POST /shopping-sessions/:id/items] Error:', error);
        if (error.message?.includes('Session not found or not active')) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found or not active'));
            return;
        }
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add item to session'));
    }
});
router.delete('/:id/items/:itemId', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const itemId = req.params.itemId;
        const sessionValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        const itemValidation = validation_1.sessionItemIdSchema.safeParse({ itemId });
        if (!sessionValidation.success || !itemValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid ID format'));
            return;
        }
        const deleted = await (0, operations_1.removeSessionItem)(userId, sessionId, itemId);
        if (!deleted) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Item not found in session'));
            return;
        }
        res.json(successResponse({ deleted: true, itemId }));
    }
    catch (error) {
        console.error('[DELETE /shopping-sessions/:id/items/:itemId] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to remove item from session'));
    }
});
router.post('/:id/complete', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const bodyValidation = validation_1.completeSessionSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        const session = await (0, operations_1.completeSession)(userId, sessionId, bodyValidation.data);
        if (!session) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found or not active'));
            return;
        }
        res.json(successResponse(session));
    }
    catch (error) {
        console.error('[POST /shopping-sessions/:id/complete] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to complete shopping session'));
    }
});
router.post('/:id/cancel', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const cancelled = await (0, operations_1.cancelSession)(userId, sessionId);
        if (!cancelled) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found or not active'));
            return;
        }
        res.json(successResponse({ cancelled: true, sessionId }));
    }
    catch (error) {
        console.error('[POST /shopping-sessions/:id/cancel] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to cancel shopping session'));
    }
});
router.post('/:id/add-to-inventory', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const result = await (0, operations_1.addSessionToInventory)(userId, sessionId);
        res.json(successResponse(result, {
            itemsAdded: result.items.length,
            activitiesLogged: result.activities.length,
        }));
    }
    catch (error) {
        console.error('[POST /shopping-sessions/:id/add-to-inventory] Error:', error);
        if (error.message?.includes('Session not found')) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found'));
            return;
        }
        if (error.message?.includes('Session must be completed')) {
            res.status(400).json(errorResponse('INVALID_STATE', 'Session must be completed before adding to inventory'));
            return;
        }
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add session items to inventory'));
    }
});
exports.default = router;
//# sourceMappingURL=shoppingSessions.js.map