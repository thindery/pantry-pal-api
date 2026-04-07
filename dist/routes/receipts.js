"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receiptOcr_1 = require("../services/receiptOcr");
const auth_1 = require("../middleware/auth");
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
router.post('/scan', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image || typeof image !== 'string') {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing or invalid image field. Expected base64 string.'));
            return;
        }
        if (!image.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid base64 image data'));
            return;
        }
        console.log('[Receipt Scan] Starting OCR...');
        const startTime = Date.now();
        const result = await (0, receiptOcr_1.scanReceiptImage)(image);
        const duration = Date.now() - startTime;
        console.log(`[Receipt Scan] OCR complete in ${duration}ms, found ${result.items.length} items`);
        res.json(successResponse({
            items: result.items,
            store: result.store,
            total: result.total,
            confidence: result.confidence,
        }, {
            ocrEngine: 'tesseract.js',
            processingTimeMs: duration,
            rawLength: result.rawText.length,
        }));
    }
    catch (error) {
        console.error('[POST /receipts/scan] Error:', error);
        res.status(500).json(errorResponse('OCR_ERROR', error instanceof Error ? error.message : 'Failed to process receipt image'));
    }
});
router.get('/health', (_req, res) => {
    res.json(successResponse({
        status: 'ok',
        ocrEngine: 'tesseract.js',
        supportedLanguages: ['eng'],
    }));
});
exports.default = router;
//# sourceMappingURL=receipts.js.map