"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
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
function calculateRunningTotal(items) {
    return items.reduce((total, item) => {
        const price = item.price || 0;
        return total + price * item.quantity;
    }, 0);
}
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
        const db = (0, db_1.getDatabase)();
        const session = await db.createSession(userId, validation.data);
        res.status(201).json(successResponse(session));
    }
    catch (error) {
        console.error('[POST /sessions] Error:', error);
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
        const db = (0, db_1.getDatabase)();
        const session = await db.getSessionById(userId, sessionId);
        if (!session) {
            res.status(404).json(errorResponse('NOT_FOUND', `Shopping session with ID ${sessionId} not found`));
            return;
        }
        const runningTotal = calculateRunningTotal(session.items);
        res.json(successResponse({
            ...session,
            runningTotal,
        }));
    }
    catch (error) {
        console.error('[GET /sessions/:id] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping session'));
    }
});
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const db = (0, db_1.getDatabase)();
        const sessions = await db.getUserSessions(userId, 100, 0);
        res.json(successResponse(sessions));
    }
    catch (error) {
        console.error('[GET /sessions] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopping sessions'));
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const bodyValidation = validation_1.updateSessionSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        const db = (0, db_1.getDatabase)();
        const existingSession = await db.getSessionById(userId, sessionId);
        if (!existingSession) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found or not active'));
            return;
        }
        if (bodyValidation.data.items && bodyValidation.data.items.length > 0) {
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
        const updatedSession = await db.getSessionById(userId, sessionId);
        if (!updatedSession) {
            res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve updated session'));
            return;
        }
        const runningTotal = calculateRunningTotal(updatedSession.items);
        res.json(successResponse({
            ...updatedSession,
            runningTotal,
        }));
    }
    catch (error) {
        console.error('[PATCH /sessions/:id] Error:', error);
        if (error.message?.includes('Session not found')) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found'));
            return;
        }
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update shopping session'));
    }
});
router.post('/:id/capture', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const bodyValidation = validation_1.captureReceiptSchema.safeParse(req.body);
        if (!bodyValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: bodyValidation.error.errors,
            }));
            return;
        }
        const db = (0, db_1.getDatabase)();
        const session = await db.getSessionById(userId, sessionId);
        if (!session) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found'));
            return;
        }
        const receipt = await db.captureSessionReceipt(userId, sessionId, bodyValidation.data.imageData, bodyValidation.data.mimeType, bodyValidation.data.notes);
        res.status(201).json(successResponse(receipt));
    }
    catch (error) {
        console.error('[POST /sessions/:id/capture] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to capture receipt'));
    }
});
router.get('/:id/receipts', async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.params.id;
        const idValidation = validation_1.sessionIdSchema.safeParse({ id: sessionId });
        if (!idValidation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid session ID format'));
            return;
        }
        const db = (0, db_1.getDatabase)();
        const session = await db.getSessionById(userId, sessionId);
        if (!session) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Shopping session not found'));
            return;
        }
        const receipts = await db.getSessionReceipts(userId, sessionId);
        res.json(successResponse(receipts));
    }
    catch (error) {
        console.error('[GET /sessions/:id/receipts] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve receipts'));
    }
});
exports.default = router;
//# sourceMappingURL=sessions.js.map