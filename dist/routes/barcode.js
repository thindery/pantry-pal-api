"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v0/product';
const PRODUCT_CACHE_MAX_AGE_DAYS = parseInt(process.env.PRODUCT_CACHE_MAX_AGE_DAYS || '1', 10);
async function lookupOpenFoodFacts(barcode) {
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
        const data = (await response.json());
        if (data.status !== 1 || !data.product) {
            return {
                success: false,
                cached: false,
                error: 'Product not found in Open Food Facts',
            };
        }
        const product = data.product;
        let category = 'other';
        const categories = product.categories?.toLowerCase() || '';
        const pnnsGroups = product.pnns_groups_1?.toLowerCase() || '';
        if (categories.includes('produce') ||
            categories.includes('fruit') ||
            categories.includes('vegetable') ||
            pnnsGroups.includes('fruits') ||
            pnnsGroups.includes('vegetables')) {
            category = 'produce';
        }
        else if (pnnsGroups.includes('milk') || pnnsGroups.includes('dairy')) {
            category = 'dairy';
        }
        else if (categories.includes('frozen') ||
            pnnsGroups.includes('frozen')) {
            category = 'frozen';
        }
        else if (categories.includes('meat') ||
            categories.includes('seafood') ||
            pnnsGroups.includes('meat') ||
            pnnsGroups.includes('fish')) {
            category = 'meat';
        }
        else if (categories.includes('beverage') ||
            pnnsGroups.includes('beverages') ||
            categories.includes('drink')) {
            category = 'beverages';
        }
        else if (categories.includes('snack') ||
            pnnsGroups.includes('snacks') ||
            categories.includes('sweet')) {
            category = 'snacks';
        }
        else if (categories.includes('bakery') ||
            categories.includes('bread') ||
            pnnsGroups.includes('bread')) {
            category = 'pantry';
        }
        const nutriments = product.nutriments || {};
        const nutrition = {};
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
    }
    catch (err) {
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
router.get('/:barcode', async (req, res) => {
    try {
        const barcode = req.params.barcode;
        if (!barcode || barcode.length < 8) {
            res.status(400).json({
                success: false,
                cached: false,
                error: 'Invalid barcode',
            });
            return;
        }
        const cleanBarcode = barcode.replace(/[^0-9]/g, '');
        if (cleanBarcode.length < 8) {
            res.status(400).json({
                success: false,
                cached: false,
                error: 'Invalid barcode format',
            });
            return;
        }
        console.log(`[Barcode] Lookup for ${cleanBarcode}, maxAgeDays=${PRODUCT_CACHE_MAX_AGE_DAYS}`);
        const cachedProduct = await (0, db_1.getDatabase)().getProductByBarcode(cleanBarcode, PRODUCT_CACHE_MAX_AGE_DAYS);
        if (cachedProduct) {
            console.log(`[Barcode] Cache hit for ${cleanBarcode}`);
            res.json({
                success: true,
                cached: true,
                product: cachedProduct,
            });
            return;
        }
        const staleProduct = await (0, db_1.getDatabase)().getProductByBarcode(cleanBarcode);
        const isStale = staleProduct !== null;
        if (isStale) {
            console.log(`[Barcode] Stale cache found for ${cleanBarcode}, refreshing...`);
        }
        console.log(`[Barcode] Cache miss for ${cleanBarcode}, calling API...`);
        const result = await lookupOpenFoodFacts(cleanBarcode);
        if (!result.success || !result.product) {
            if (isStale) {
                console.log(`[Barcode] API failed, returning stale cache for ${cleanBarcode}`);
                res.json({
                    success: true,
                    cached: true,
                    stale: true,
                    product: staleProduct,
                });
                return;
            }
            res.status(404).json(result);
            return;
        }
        await (0, db_1.getDatabase)().saveProduct({
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
        res.json({
            success: true,
            cached: false,
            product: result.product,
        });
    }
    catch (error) {
        console.error('[GET /barcode/:barcode] Error:', error);
        res.status(500).json({
            success: false,
            cached: false,
            error: 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=barcode.js.map