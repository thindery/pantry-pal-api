/**
 * Scan API Routes
 * Endpoints for receipt scanning and visual usage detection
 * Integrates with AI/ML services for automated inventory management
 * All routes require authentication
 */

import { Router } from 'express';
import {
  processReceiptScan,
  processVisualUsage,
  createItem,
  getItemByName,
  logActivity,
} from '../db';
import { requireAuth } from '../middleware/auth';
import { ApiResponse, ScanResult } from '../models/types';
import {
  scanReceiptSchema,
  visualUsageSchema,
} from '../models/validation';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// Helper Functions
// ============================================================================

function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

function errorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse<never> {
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

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/scan-receipt
 * Process receipt scan data and return standardized results
 * Accepts raw OCR text or pre-structured item data
 */
router.post('/scan-receipt', (req, res) => {
  try {
    const validation = scanReceiptSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const { scanData, minConfidence } = validation.data;

    // Process the scan data
    const results = processReceiptScan(scanData);

    // Filter by confidence if specified
    let filteredResults = results;
    if (minConfidence !== undefined && Array.isArray(scanData)) {
      // In a real implementation, confidence scores would come from the ML model
      // For now, we assume all parsed results meet the threshold
      filteredResults = results;
    }

    res.json(
      successResponse(filteredResults, {
        itemCount: filteredResults.length,
        processedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('[POST /scan-receipt] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to process receipt scan')
    );
  }
});

/**
 * POST /api/scan-receipt/import
 * Process receipt and automatically import items to inventory
 * Adds detected items as ADD activities
 */
router.post('/scan-receipt/import', async (req, res) => {
  try {
    const userId = req.userId!;
    const validation = scanReceiptSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const { scanData } = validation.data;

    // Parse the scan data
    const results: ScanResult[] = processReceiptScan(scanData);
    const imported: Array<{ itemId: string; name: string; quantity: number; activityId: string }> = [];
    const errors: string[] = [];

    for (const scanResult of results) {
      try {
        // Check if item already exists for this user
        let item = getItemByName(userId, scanResult.name);

        if (!item) {
          // Create new item
          item = createItem(userId, {
            name: scanResult.name,
            quantity: 0,
            unit: scanResult.unit || 'pieces',
            category: scanResult.category || 'general',
          });
        }

        // Log ADD activity
        const activity = logActivity(
          userId,
          item.id,
          'ADD',
          scanResult.quantity,
          'RECEIPT_SCAN'
        );

        if (activity) {
          imported.push({
            itemId: item.id,
            name: item.name,
            quantity: scanResult.quantity,
            activityId: activity.id,
          });
        } else {
          errors.push(`Failed to log activity for: ${scanResult.name}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error importing ${scanResult.name}: ${errorMessage}`);
      }
    }

    res.json(
      successResponse(
        { imported, errors },
        {
          totalProcessed: results.length,
          successfulImports: imported.length,
          failedImports: errors.length,
          processedAt: new Date().toISOString(),
        }
      )
    );
  } catch (error) {
    console.error('[POST /scan-receipt/import] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to import receipt items')
    );
  }
});

/**
 * POST /api/visual-usage
 * Process visual usage detection results
 * Automatically creates REMOVE activities for detected usage
 */
router.post('/visual-usage', (req, res) => {
  try {
    const userId = req.userId!;
    const validation = visualUsageSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid request body', {
          errors: validation.error.errors,
        })
      );
      return;
    }

    const { detections, detectionSource } = validation.data;
    const source = detectionSource || 'VISUAL_USAGE';

    // Process detections and create activities
    const results = processVisualUsage(userId, detections, source);

    res.json(
      successResponse(
        {
          processed: results.processed,
          activities: results.activities,
          errors: results.errors,
        },
        {
          totalDetections: detections.length,
          successful: results.processed.length,
          failed: results.errors.length,
          processedAt: new Date().toISOString(),
        }
      )
    );
  } catch (error) {
    console.error('[POST /visual-usage] Error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to process visual usage detection')
    );
  }
});

/**
 * GET /api/visual-usage/supported-items
 * Get list of items that can be detected by the visual system
 * Useful for frontend to show what's detectable
 */
router.get('/visual-usage/supported-items', (_req, res) => {
  // In production, this would query the ML model for supported classifications
  // For now, return a mock list of commonly detectable kitchen items
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

  res.json(
    successResponse(supportedItems, {
      totalSupported: supportedItems.length,
      modelVersion: 'v1.0.0',
    })
  );
});

export default router;
