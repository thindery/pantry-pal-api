"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
router.post('/', async (req, res) => {
    try {
        const error = {
            userId: req.body.userId,
            errorType: req.body.type,
            errorMessage: req.body.message,
            errorStack: req.body.stack,
            component: req.body.component,
            url: req.body.url,
            userAgent: req.body.userAgent,
        };
        const saved = await (0, db_1.getDatabase)().saveClientError(error);
        res.json({ success: true, id: saved.id });
    }
    catch (err) {
        console.error('Failed to save client error:', err);
        res.status(500).json({ error: 'Failed to save' });
    }
});
router.get('/', async (req, res) => {
    try {
        const { resolved = 'false', limit = '50' } = req.query;
        const errors = await (0, db_1.getDatabase)().getClientErrors({
            resolved: resolved === 'true',
            limit: parseInt(limit),
        });
        res.json({ errors });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch' });
    }
});
router.patch('/:id/resolve', async (req, res) => {
    try {
        await (0, db_1.getDatabase)().markErrorResolved(req.params.id);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to resolve' });
    }
});
exports.default = router;
//# sourceMappingURL=clientErrors.js.map