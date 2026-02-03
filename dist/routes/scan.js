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
router.post('/scan-receipt', (req, res) => {
    try {
        const validation = validation_1.scanReceiptSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const { scanData, minConfidence } = validation.data;
        const results = (0, db_1.processReceiptScan)(scanData);
        let filteredResults = results;
        if (minConfidence !== undefined && Array.isArray(scanData)) {
            filteredResults = results;
        }
        res.json(successResponse(filteredResults, {
            itemCount: filteredResults.length,
            processedAt: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error('[POST /scan-receipt] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to process receipt scan'));
    }
});
router.post('/scan-receipt/import', async (req, res) => {
    try {
        const validation = validation_1.scanReceiptSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const { scanData } = validation.data;
        const results = (0, db_1.processReceiptScan)(scanData);
        const imported = [];
        const errors = [];
        for (const scanResult of results) {
            try {
                let item = (0, db_1.getItemByName)(scanResult.name);
                if (!item) {
                    item = (0, db_1.createItem)({
                        name: scanResult.name,
                        quantity: 0,
                        unit: scanResult.unit || 'pieces',
                        category: scanResult.category || 'general',
                    });
                }
                const activity = (0, db_1.logActivity)(item.id, 'ADD', scanResult.quantity, 'RECEIPT_SCAN');
                if (activity) {
                    imported.push({
                        itemId: item.id,
                        name: item.name,
                        quantity: scanResult.quantity,
                        activityId: activity.id,
                    });
                }
                else {
                    errors.push(`Failed to log activity for: ${scanResult.name}`);
                }
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`Error importing ${scanResult.name}: ${errorMessage}`);
            }
        }
        res.json(successResponse({ imported, errors }, {
            totalProcessed: results.length,
            successfulImports: imported.length,
            failedImports: errors.length,
            processedAt: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error('[POST /scan-receipt/import] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to import receipt items'));
    }
});
router.post('/visual-usage', (req, res) => {
    try {
        const validation = validation_1.visualUsageSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid request body', {
                errors: validation.error.errors,
            }));
            return;
        }
        const { detections, detectionSource } = validation.data;
        const source = detectionSource || 'VISUAL_USAGE';
        const results = (0, db_1.processVisualUsage)(detections, source);
        res.json(successResponse({
            processed: results.processed,
            activities: results.activities,
            errors: results.errors,
        }, {
            totalDetections: detections.length,
            successful: results.processed.length,
            failed: results.errors.length,
            processedAt: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error('[POST /visual-usage] Error:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to process visual usage detection'));
    }
});
router.get('/visual-usage/supported-items', (_req, res) => {
    const supportedItems = [
        { name: 'apple', category: 'produce', typicalUnit: 'pieces' },
        { name: 'banana', category: 'produce', typicalUnit: 'pieces' },
        { name: 'milk', category: 'dairy', typicalUnit: 'gallons' },
        { name: 'eggs', category: 'dairy', typicalUnit: 'pieces' },
        { name: 'bread', category: 'bakery', typicalUnit: 'loaves' },
        { name: 'chicken', category: 'meat', typicalUnit: 'lbs' },
        { name: 'rice', category: 'pantry', typicalUnit: 'cups' },
        { name: 'pasta', category: 'pantry', typicalUnit: 'lbs' },
        { name: 'tomato', category: 'produce', typicalUnit: 'pieces' },
        { name: 'onion', category: 'produce', typicalUnit: 'pieces' },
        { name: 'cheese', category: 'dairy', typicalUnit: 'lbs' },
        { name: 'yogurt', category: 'dairy', typicalUnit: 'cups' },
        { name: 'carrot', category: 'produce', typicalUnit: 'pieces' },
        { name: 'lettuce', category: 'produce', typicalUnit: 'heads' },
        { name: 'potato', category: 'produce', typicalUnit: 'pieces' },
    ];
    res.json(successResponse(supportedItems, {
        totalSupported: supportedItems.length,
        modelVersion: 'v1.0.0',
    }));
});
exports.default = router;
//# sourceMappingURL=scan.js.map