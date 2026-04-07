"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const admin_1 = require("../db/admin");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
router.get('/dashboard', async (req, res) => {
    try {
        const periodParam = req.query.period;
        const period = ['7d', '30d', '90d'].includes(periodParam)
            ? periodParam
            : '7d';
        const metrics = await (0, admin_1.getDashboardMetrics)(period);
        res.json(successResponse(metrics));
    }
    catch (error) {
        console.error('[GET /admin/dashboard] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve dashboard metrics', {
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});
router.get('/transactions', async (req, res) => {
    try {
        const limitParam = parseInt(req.query.limit, 10);
        const limit = isNaN(limitParam) || limitParam < 1
            ? 10
            : Math.min(limitParam, 100);
        const cursor = req.query.cursor;
        const result = await (0, admin_1.getTransactions)(limit, cursor);
        res.json(successResponse(result));
    }
    catch (error) {
        console.error('[GET /admin/transactions] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve transactions', {
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});
router.get('/alerts', async (_req, res) => {
    try {
        const alerts = await (0, admin_1.getFailedPaymentAlerts)();
        res.json(successResponse(alerts));
    }
    catch (error) {
        console.error('[GET /admin/alerts] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to retrieve alerts', {
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map