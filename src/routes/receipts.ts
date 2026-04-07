/**
 * Receipt Scanning API Routes
 * Tesseract.js-based OCR for receipt scanning
 * POST /api/receipts/scan - Upload image, get extracted items
 */

import { Router } from 'express';
import { scanReceiptImage } from '../services/receiptOcr';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../models/types';

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
 * POST /api/receipts/scan
 * Scan a receipt image using Tesseract.js OCR
 * Body: { image: base64String }
 * Returns: { items: [{ name, quantity, unit, category, price }] }
 */
router.post('/scan', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Missing or invalid image field. Expected base64 string.')
      );
      return;
    }

    // Validate base64 (basic check)
    if (!image.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid base64 image data')
      );
      return;
    }

    console.log('[Receipt Scan] Starting OCR...');
    const startTime = Date.now();

    // Run OCR
    const result = await scanReceiptImage(image);

    const duration = Date.now() - startTime;
    console.log(`[Receipt Scan] OCR complete in ${duration}ms, found ${result.items.length} items`);

    res.json(
      successResponse(
        {
          items: result.items,
          store: result.store,
          total: result.total,
          confidence: result.confidence,
        },
        {
          ocrEngine: 'tesseract.js',
          processingTimeMs: duration,
          rawLength: result.rawText.length,
        }
      )
    );
  } catch (error) {
    console.error('[POST /receipts/scan] Error:', error);
    res.status(500).json(
      errorResponse(
        'OCR_ERROR',
        error instanceof Error ? error.message : 'Failed to process receipt image'
      )
    );
  }
});

/**
 * GET /api/receipts/health
 * Health check for receipt scanning service
 */
router.get('/health', (_req, res) => {
  res.json(
    successResponse({
      status: 'ok',
      ocrEngine: 'tesseract.js',
      supportedLanguages: ['eng'],
    })
  );
});

export default router;
