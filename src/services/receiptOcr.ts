/**
 * Receipt OCR Service
 * Tesseract.js-based receipt scanning with Sharp preprocessing
 */

import Tesseract from 'tesseract.js';
import Sharp from 'sharp';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
  price?: number;
  confidence?: number;
}

export interface ReceiptScanResult {
  items: ReceiptItem[];
  store?: string;
  date?: string;
  total?: number;
  rawText: string;
  confidence: number;
}

// Common grocery categories for auto-detection
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach', 'pepper', 'cucumber', 'grape', 'strawberry', 'blueberry', 'melon', 'watermelon', 'peach', 'pear', 'plum', 'cherry', 'avocado', 'lemon', 'lime', 'garlic', 'ginger', 'mushroom', 'celery', 'asparagus', 'corn', 'cabbage', 'cauliflower'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'eggs', 'sour cream', 'cottage cheese', 'cream cheese', 'whipped cream', 'half and half', 'buttermilk', 'cheddar', 'mozzarella', 'parmesan', 'brie', 'feta'],
  meat: ['chicken', 'beef', 'pork', 'turkey', 'sausage', 'bacon', 'ham', 'steak', 'ground beef', 'ribs', 'lamb', 'venison', 'salami', 'pepperoni', 'hot dog', 'bratwurst'],
  frozen: ['frozen', 'ice cream', 'pizza', 'microwave', 'tv dinner', 'fries', 'frozen vegetables', 'frozen fruit', 'popsicle', 'waffle', 'breakfast sandwich'],
  beverages: ['water', 'soda', 'juice', 'coffee', 'tea', 'beer', 'wine', 'soda', 'pop', 'coke', 'pepsi', 'sprite', 'dr pepper', 'mountain dew', 'energy drink', 'sports drink', 'gatorade', 'powerade', 'red bull', 'monster'],
  pantry: ['pasta', 'rice', 'bread', 'cereal', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'soup', 'can', 'canned', 'jar', 'box', 'chip', 'cracker', 'cookie', 'snack', 'nut', 'dried fruit', 'honey', 'jam', 'jelly', 'peanut butter', 'oatmeal', 'granola', 'tortilla', 'pita'],
  snacks: ['chip', 'cracker', 'cookie', 'candy', 'chocolate', 'popcorn', 'pretzel', 'nut', 'trail mix', 'granola bar', 'protein bar', 'jerky', 'gum', 'mint'],
};

function detectCategory(itemName: string): string {
  const lowerName = itemName.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerName.includes(kw))) {
      return category;
    }
  }
  return 'other';
}

function parseQuantity(text: string): { quantity: number; unit: string } {
  // Look for patterns like "2x", "3 units", "1.5 lbs", "16 oz"
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

  // Default: look for any number
  const numberMatch = text.match(/(\d+)/);
  if (numberMatch) {
    return { quantity: parseInt(numberMatch[1]), unit: 'units' };
  }

  return { quantity: 1, unit: 'units' };
}

export async function scanReceiptImage(base64Image: string): Promise<ReceiptScanResult> {
  try {
    // Decode base64 to buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');

    // Preprocess with Sharp: grayscale, normalize, sharpen
    const processedBuffer = await Sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen(1, 1, 2)
      .toBuffer();

    // Run Tesseract OCR
    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
        }
      },
    });

    const rawText = result.data.text;
    const confidence = result.data.confidence;

    // Parse lines into items
    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 2);

    const items: ReceiptItem[] = [];

    for (const line of lines) {
      // Skip lines that look like headers, totals, or non-items
      if (
        line.match(/^(subtotal|tax|total|balance|paid|change|thank|cashi?er|date|time|phone|address|www\.|http)/i) ||
        line.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) ||
        line.length < 3
      ) {
        continue;
      }

      // Try to extract item name and price
      const priceMatch = line.match(/\$?([\d,]+\.\d{2})/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : undefined;

      // Remove price from line to get item name
      let itemName = line.replace(/\$?[\d,]+\.\d{2}/, '').trim();
      itemName = itemName.replace(/^\d+\s+/, '').trim(); // Remove leading quantity number

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

    // Extract store name (usually at the top)
    const storeMatch = lines[0]?.match(/^([A-Z][A-Za-z0-9\s&]+)$/);
    const store = storeMatch ? storeMatch[1].trim() : undefined;

    // Extract total
    const totalMatch = rawText.match(/total[\s:$]*([\d,]+\.\d{2})/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : undefined;

    return {
      items,
      store,
      total,
      rawText,
      confidence,
    };
  } catch (error) {
    console.error('Receipt OCR failed:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
