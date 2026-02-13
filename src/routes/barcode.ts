/**
 * Barcode Lookup API Routes
 * Endpoints for looking up product information by barcode
 * Implements caching to reduce third-party API calls
 * All routes require authentication
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDatabase } from '../db';
import { BarcodeLookupResponse } from '../models/types';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// Type Definitions
// ============================================================================

interface OpenFoodFactsResponse {
  status: number;
  product?: {
    product_name?: string;
    generic_name?: string;
    brands?: string;
    categories?: string;
    pnns_groups_1?: string;
    image_url?: string;
    ingredients_text?: string;
    nutriments?: {
      'energy-kcal'?: number;
      proteins?: number;
      carbohydrates?: number;
      fat?: number;
      salt?: number;
      sugars?: number;
    };
  };
}

// ============================================================================
// Configuration
// ============================================================================

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v0/product';
const PRODUCT_CACHE_MAX_AGE_DAYS = parseInt(
  process.env.PRODUCT_CACHE_MAX_AGE_DAYS || '1',
  10
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Look up product by barcode using Open Food Facts API
 */
async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeLookupResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${OPEN_FOOD_FACTS_API}/${barcode}.json`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = (await response.json()) as OpenFoodFactsResponse;

    if (data.status !== 1 || !data.product) {
      return {
        success: false,
        cached: false,
        error: 'Product not found in Open Food Facts',
      };
    }

    const product = data.product;

    // Map Open Food Facts categories to our categories
    let category = 'other';
    const categories = product.categories?.toLowerCase() || '';
    const pnnsGroups = product.pnns_groups_1?.toLowerCase() || '';

    if (
      categories.includes('produce') ||
      categories.includes('fruit') ||
      categories.includes('vegetable') ||
      pnnsGroups.includes('fruits') ||
      pnnsGroups.includes('vegetables')
    ) {
      category = 'produce';
    } else if (pnnsGroups.includes('milk') || pnnsGroups.includes('dairy')) {
      category = 'dairy';
    } else if (
      categories.includes('frozen') ||
      pnnsGroups.includes('frozen')
    ) {
      category = 'frozen';
    } else if (
      categories.includes('meat') ||
      categories.includes('seafood') ||
      pnnsGroups.includes('meat') ||
      pnnsGroups.includes('fish')
    ) {
      category = 'meat';
    } else if (
      categories.includes('beverage') ||
      pnnsGroups.includes('beverages') ||
      categories.includes('drink')
    ) {
      category = 'beverages';
    } else if (
      categories.includes('snack') ||
      pnnsGroups.includes('snacks') ||
      categories.includes('sweet')
    ) {
      category = 'snacks';
    } else if (
      categories.includes('bakery') ||
      categories.includes('bread') ||
      pnnsGroups.includes('bread')
    ) {
      category = 'pantry';

    }

    // Extract nutrition data if available
    const nutriments = product.nutriments || {};
    const nutrition: Record<string, number> = {};

    if (nutriments['energy-kcal'] !== undefined) {
      nutrition.calories = nutriments['energy-kcal'];
    }
    if (nutriments.proteins !== undefined) {
      nutrition.protein = nutriments.proteins;
    }
    if (nutriments.carbohydrates !== undefined) {
      nutrition.carbs = nutriments.carbohydrates;
    }
    if (nutriments.fat !== undefined) {
      nutrition.fat = nutriments.fat;
    }
    if (nutriments.salt !== undefined) {
      nutrition.sodium = nutriments.salt;
    }
    if (nutriments.sugars !== undefined) {
      nutrition.sugars = nutriments.sugars;
    }

    return {
      success: true,
      cached: false,
      product: {
        barcode,
        name: product.product_name || product.generic_name || 'Unknown Product',
        brand: product.brands?.split(',')[0]?.trim(),
        category,
        imageUrl: product.image_url,
        ingredients: product.ingredients_text,
        nutrition: Object.keys(nutrition).length > 0 ? nutrition : undefined,
        source: 'openfoodfacts',
        infoLastSynced: new Date().toISOString(),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        cached: false,
        error: 'Request timed out',
      };
    }
    return {
      success: false,
      cached: false,
      error: `Failed to fetch: ${errorMessage}`,
    };
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/barcode/:barcode
 * Look up product information by barcode
 * Checks local cache first, falls back to Open Food Facts API
 */
router.get('/:barcode', async (req, res) => {
  try {
    const barcode = req.params.barcode;

    // Validate barcode
    if (!barcode || barcode.length < 8) {
      res.status(400).json({
        success: false,
        cached: false,
        error: 'Invalid barcode',
      } as BarcodeLookupResponse);
      return;
    }

    // Clean barcode - remove any non-numeric characters
    const cleanBarcode = barcode.replace(/[^0-9]/g, '');
    if (cleanBarcode.length < 8) {
      res.status(400).json({
        success: false,
        cached: false,
        error: 'Invalid barcode format',
      } as BarcodeLookupResponse);
      return;
    }

    console.log(
      `[Barcode] Lookup for ${cleanBarcode}, maxAgeDays=${PRODUCT_CACHE_MAX_AGE_DAYS}`
    );

    // Step 1: Check local cache
    const cachedProduct = await getDatabase().getProductByBarcode(
      cleanBarcode,
      PRODUCT_CACHE_MAX_AGE_DAYS
    );

    if (cachedProduct) {
      console.log(`[Barcode] Cache hit for ${cleanBarcode}`);
      res.json({
        success: true,
        cached: true,
        product: cachedProduct,
      } as BarcodeLookupResponse);
      return;
    }

    // Step 2: Check if there's stale cache (for optional retrieval)
    const staleProduct = await getDatabase().getProductByBarcode(cleanBarcode); // no maxAgeDays
    const isStale = staleProduct !== null;

    if (isStale) {
      console.log(`[Barcode] Stale cache found for ${cleanBarcode}, refreshing...`);
    }

    // Step 3: Call Open Food Facts API
    console.log(`[Barcode] Cache miss for ${cleanBarcode}, calling API...`);
    const result = await lookupOpenFoodFacts(cleanBarcode);

    if (!result.success || !result.product) {
      // If we have stale cache and API failed, return stale cache
      if (isStale) {
        console.log(`[Barcode] API failed, returning stale cache for ${cleanBarcode}`);
        res.json({
          success: true,
          cached: true,
          stale: true,
          product: staleProduct,
        } as BarcodeLookupResponse);
        return;
      }

      // API failed and no cache
      res.status(404).json(result);
      return;
    }

    // Step 4: Save to cache
    await getDatabase().saveProduct({
      barcode: result.product.barcode,
      name: result.product.name,
      brand: result.product.brand,
      category: result.product.category,
      imageUrl: result.product.imageUrl,
      ingredients: result.product.ingredients,
      nutrition: result.product.nutrition,
      source: result.product.source,
    });

    console.log(`[Barcode] Cached result for ${cleanBarcode}`);

    // Step 5: Return fresh data
    res.json({
      success: true,
      cached: false,
      product: result.product,
    } as BarcodeLookupResponse);
  } catch (error) {
    console.error('[GET /barcode/:barcode] Error:', error);
    res.status(500).json({
      success: false,
      cached: false,
      error: 'Internal server error',
    } as BarcodeLookupResponse);
  }
});

export default router;
