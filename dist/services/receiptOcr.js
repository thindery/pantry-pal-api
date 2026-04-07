"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanReceiptImage = scanReceiptImage;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const sharp_1 = __importDefault(require("sharp"));
const CATEGORY_KEYWORDS = {
    produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach', 'pepper', 'cucumber', 'grape', 'strawberry', 'blueberry', 'melon', 'watermelon', 'peach', 'pear', 'plum', 'cherry', 'avocado', 'lemon', 'lime', 'garlic', 'ginger', 'mushroom', 'celery', 'asparagus', 'corn', 'cabbage', 'cauliflower'],
    dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'eggs', 'sour cream', 'cottage cheese', 'cream cheese', 'whipped cream', 'half and half', 'buttermilk', 'cheddar', 'mozzarella', 'parmesan', 'brie', 'feta'],
    meat: ['chicken', 'beef', 'pork', 'turkey', 'sausage', 'bacon', 'ham', 'steak', 'ground beef', 'ribs', 'lamb', 'venison', 'salami', 'pepperoni', 'hot dog', 'bratwurst'],
    frozen: ['frozen', 'ice cream', 'pizza', 'microwave', 'tv dinner', 'fries', 'frozen vegetables', 'frozen fruit', 'popsicle', 'waffle', 'breakfast sandwich'],
    beverages: ['water', 'soda', 'juice', 'coffee', 'tea', 'beer', 'wine', 'soda', 'pop', 'coke', 'pepsi', 'sprite', 'dr pepper', 'mountain dew', 'energy drink', 'sports drink', 'gatorade', 'powerade', 'red bull', 'monster'],
    pantry: ['pasta', 'rice', 'bread', 'cereal', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'soup', 'can', 'canned', 'jar', 'box', 'chip', 'cracker', 'cookie', 'snack', 'nut', 'dried fruit', 'honey', 'jam', 'jelly', 'peanut butter', 'oatmeal', 'granola', 'tortilla', 'pita'],
    snacks: ['chip', 'cracker', 'cookie', 'candy', 'chocolate', 'popcorn', 'pretzel', 'nut', 'trail mix', 'granola bar', 'protein bar', 'jerky', 'gum', 'mint'],
};
function detectCategory(itemName) {
    const lowerName = itemName.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lowerName.includes(kw))) {
            return category;
        }
    }
    return 'other';
}
function parseQuantity(text) {
    const patterns = [
        { regex: /(\d+\.?\d*)?\s*x?\s*(\d+\.?\d*)\s*(lbs?|pounds?|lb)/i, unit: 'lbs' },
        { regex: /(\d+\.?\d*)\s*(oz|ounces?)/i, unit: 'oz' },
        { regex: /(\d+\.?\d*)\s*(g|grams?)/i, unit: 'grams' },
        { regex: /(\d+\.?\d*)\s*(kg|kilos?)/i, unit: 'kg' },
        { regex: /(\d+\.?\d*)\s*(cups?)/i, unit: 'cups' },
        { regex: /(\d+\.?\d*)\s*(bottles?)/i, unit: 'bottles' },
        { regex: /(\d+\.?\d*)\s*(cans?)/i, unit: 'cans' },
        { regex: /(\d+\.?\d*)\s*(boxes?)/i, unit: 'boxes' },
        { regex: /(\d+\.?\d*)\s*(bags?)/i, unit: 'bags' },
        { regex: /(\d+)\s*x\s*(\d+)/i, multiplier: true },
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match) {
            if ('multiplier' in pattern && pattern.multiplier) {
                const qty = parseInt(match[1]) * parseInt(match[2]);
                return { quantity: qty, unit: 'units' };
            }
            const qty = parseFloat(match[1] || match[2] || '1');
            return { quantity: qty, unit: pattern.unit || 'units' };
        }
    }
    const numberMatch = text.match(/(\d+)/);
    if (numberMatch) {
        return { quantity: parseInt(numberMatch[1]), unit: 'units' };
    }
    return { quantity: 1, unit: 'units' };
}
async function scanReceiptImage(base64Image) {
    try {
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const processedBuffer = await (0, sharp_1.default)(imageBuffer)
            .grayscale()
            .normalize()
            .sharpen(1, 1, 2)
            .toBuffer();
        const result = await tesseract_js_1.default.recognize(processedBuffer, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
                }
            },
        });
        const rawText = result.data.text;
        const confidence = result.data.confidence;
        const lines = rawText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 2);
        const items = [];
        for (const line of lines) {
            if (line.match(/^(subtotal|tax|total|balance|paid|change|thank|cashi?er|date|time|phone|address|www\.|http)/i) ||
                line.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) ||
                line.length < 3) {
                continue;
            }
            const priceMatch = line.match(/\$?([\d,]+\.\d{2})/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : undefined;
            let itemName = line.replace(/\$?[\d,]+\.\d{2}/, '').trim();
            itemName = itemName.replace(/^\d+\s+/, '').trim();
            if (itemName && itemName.length > 1) {
                const { quantity, unit } = parseQuantity(line);
                const category = detectCategory(itemName);
                items.push({
                    name: itemName,
                    quantity,
                    unit,
                    category,
                    price,
                    confidence: result.data.confidence,
                });
            }
        }
        const storeMatch = lines[0]?.match(/^([A-Z][A-Za-z0-9\s&]+)$/);
        const store = storeMatch ? storeMatch[1].trim() : undefined;
        const totalMatch = rawText.match(/total[\s:$]*([\d,]+\.\d{2})/i);
        const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : undefined;
        return {
            items,
            store,
            total,
            rawText,
            confidence,
        };
    }
    catch (error) {
        console.error('Receipt OCR failed:', error);
        throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=receiptOcr.js.map