"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const validation_1 = require("../models/validation");
const router = (0, express_1.Router)();
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
router.get('/', (req, res) => {
    try {
        const pagination = validation_1.paginationSchema.safeParse(req.query);
        const { itemId } = req.query;
        if (itemId) {
            const idValidation = validation_1.itemIdSchema.safeParse({ id: itemId });
            if (!idValidation.success) {
                res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid itemId format'));
                return;
            }
        }
        const page = pagination.success ? pagination.data.page : 1;
        const limit = pagination.success ? pagination.data.limit : 20;
        const offset = (page - 1) * limit;
        const activities = (0, db_1.getActivities)(limit, offset, itemId);
        const total = (0, db_1.getActivityCount)(itemId);
        res.json(successResponse(activities, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }));
    }
    catch (error) {
        console.error('[GET /activities] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve activities'));
    }
});
router.post('/', (req, res) => {
    try {
        const validation = validation_1.createActivitySchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const { itemId, type, amount, source } = validation.data;
        const activity = (0, db_1.logActivity)(itemId, type, amount, source);
        if (!activity) {
            res.status(404).json(errorResponse('NOT_FOUND', `Item with ID ${itemId} not found`));
            return;
        }
        res.status(201).json(successResponse(activity));
    }
    catch (error) {
        console.error('[POST /activities] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to log activity'));
    }
});
exports.default = router;
//# sourceMappingURL=activities.js.map