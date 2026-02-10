"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = require("../services/stripe");
const router = (0, express_1.Router)();
router.post('/stripe', (0, express_1.raw)({ type: 'application/json' }), async (req, res) => {
    try {
        const payload = req.body;
        const signature = req.headers['stripe-signature'];
        if (!signature) {
            res.status(400).json({
                received: false,
                error: 'Missing stripe-signature header',
            });
            return;
        }
        const result = await (0, stripe_1.handleWebhookEvent)(payload, signature);
        if (result.received) {
            res.json({ received: true });
        }
        else {
            res.status(400).json({ received: false });
        }
    }
    catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        res.status(400).json({
            received: false,
            error: error instanceof Error ? error.message : 'Webhook processing failed',
        });
    }
});
exports.default = router;
//# sourceMappingURL=webhook.js.map