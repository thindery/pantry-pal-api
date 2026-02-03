"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const db_1 = require("../db");
const sampleItems = [
    { name: 'Organic Bananas', quantity: 6, unit: 'pieces', category: 'produce' },
    { name: 'Gala Apples', quantity: 4, unit: 'pieces', category: 'produce' },
    { name: 'Avocados', quantity: 3, unit: 'pieces', category: 'produce' },
    { name: 'Roma Tomatoes', quantity: 5, unit: 'pieces', category: 'produce' },
    { name: 'Yellow Onions', quantity: 3, unit: 'pieces', category: 'produce' },
    { name: 'Garlic', quantity: 1, unit: 'bulb', category: 'produce' },
    { name: 'Fresh Spinach', quantity: 1, unit: 'bag', category: 'produce' },
    { name: 'Broccoli', quantity: 2, unit: 'heads', category: 'produce' },
    { name: 'Carrots', quantity: 1, unit: 'lbs', category: 'produce' },
    { name: 'Whole Milk', quantity: 1, unit: 'gallon', category: 'dairy' },
    { name: 'Large Eggs', quantity: 12, unit: 'pieces', category: 'dairy' },
    { name: 'Cheddar Cheese', quantity: 0.5, unit: 'lbs', category: 'dairy' },
    { name: 'Greek Yogurt', quantity: 4, unit: 'cups', category: 'dairy' },
    { name: 'Butter', quantity: 1, unit: 'sticks', category: 'dairy' },
    { name: 'Heavy Cream', quantity: 1, unit: 'pint', category: 'dairy' },
    { name: 'Long Grain Rice', quantity: 2, unit: 'lbs', category: 'pantry' },
    { name: 'Spaghetti', quantity: 1, unit: 'lbs', category: 'pantry' },
    { name: 'All-Purpose Flour', quantity: 5, unit: 'lbs', category: 'pantry' },
    { name: 'Granulated Sugar', quantity: 2, unit: 'lbs', category: 'pantry' },
    { name: 'Extra Virgin Olive Oil', quantity: 16, unit: 'oz', category: 'pantry' },
    { name: 'Canned Tomatoes', quantity: 3, unit: 'cans', category: 'pantry' },
    { name: 'Black Beans', quantity: 2, unit: 'cans', category: 'pantry' },
    { name: 'Chicken Broth', quantity: 32, unit: 'oz', category: 'pantry' },
    { name: 'Soy Sauce', quantity: 8, unit: 'oz', category: 'pantry' },
    { name: 'Honey', quantity: 12, unit: 'oz', category: 'pantry' },
    { name: 'Peanut Butter', quantity: 16, unit: 'oz', category: 'pantry' },
    { name: 'Oats', quantity: 18, unit: 'oz', category: 'pantry' },
    { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'meat' },
    { name: 'Ground Beef', quantity: 1, unit: 'lbs', category: 'meat' },
    { name: 'Bacon', quantity: 1, unit: 'pack', category: 'meat' },
    { name: 'Salmon Fillet', quantity: 1, unit: 'lbs', category: 'meat' },
    { name: 'Sandwich Bread', quantity: 1, unit: 'loaf', category: 'bakery' },
    { name: 'Bagels', quantity: 6, unit: 'pieces', category: 'bakery' },
    { name: 'Flour Tortillas', quantity: 8, unit: 'pieces', category: 'bakery' },
    { name: 'Sparkling Water', quantity: 12, unit: 'cans', category: 'beverages' },
    { name: 'Coffee Beans', quantity: 12, unit: 'oz', category: 'beverages' },
    { name: 'Orange Juice', quantity: 64, unit: 'oz', category: 'beverages' },
    { name: 'Frozen Broccoli', quantity: 1, unit: 'bag', category: 'frozen' },
    { name: 'Ice Cream', quantity: 1, unit: 'pint', category: 'frozen' },
    { name: 'Frozen Pizza', quantity: 2, unit: 'pieces', category: 'frozen' },
];
function clearDatabase() {
    const db = (0, db_1.getDatabase)();
    console.log('[SEED] Clearing existing data...');
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('DELETE FROM activities;');
    db.exec('DELETE FROM pantry_items;');
    db.exec('VACUUM;');
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('[SEED] Database cleared');
}
function seedItems() {
    console.log(`[SEED] Creating ${sampleItems.length} pantry items...`);
    const itemIds = [];
    for (const item of sampleItems) {
        const created = (0, db_1.createItem)(item);
        itemIds.push(created.id);
    }
    console.log(`[SEED] Created ${itemIds.length} items`);
    return itemIds;
}
function seedActivities(itemIds) {
    console.log('[SEED] Creating sample activities...');
    const activities = [];
    const itemsForActivities = itemIds.slice(0, 15);
    for (const itemId of itemsForActivities) {
        if (Math.random() > 0.4) {
            activities.push({
                itemId,
                type: 'ADD',
                amount: Math.floor(Math.random() * 5) + 1,
                source: 'MANUAL',
            });
        }
        if (Math.random() > 0.7) {
            activities.push({
                itemId,
                type: 'REMOVE',
                amount: Math.floor(Math.random() * 3) + 1,
                source: Math.random() > 0.5 ? 'VISUAL_USAGE' : 'MANUAL',
            });
        }
    }
    const receiptItems = itemIds.slice(15, 20);
    for (const itemId of receiptItems) {
        activities.push({
            itemId,
            type: 'ADD',
            amount: Math.floor(Math.random() * 3) + 1,
            source: 'RECEIPT_SCAN',
        });
    }
    let successCount = 0;
    for (const activity of activities) {
        const logged = (0, db_1.logActivity)(activity.itemId, activity.type, activity.amount, activity.source);
        if (logged)
            successCount++;
    }
    console.log(`[SEED] Created ${successCount} activities`);
}
function printSummary() {
    const db = (0, db_1.getDatabase)();
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM pantry_items').get().count;
    const activityCount = db.prepare('SELECT COUNT(*) as count FROM activities').get().count;
    const categoryCount = db.prepare('SELECT COUNT(DISTINCT category) as count FROM pantry_items').get().count;
    console.log('\n[SEED] ===========================================');
    console.log('[SEED] Seed Summary');
    console.log('[SEED] ===========================================');
    console.log(`[SEED] Total Items:      ${itemCount}`);
    console.log(`[SEED] Total Activities: ${activityCount}`);
    console.log(`[SEED] Categories:       ${categoryCount}`);
    console.log('[SEED] ===========================================\n');
    console.log('[SEED] Category Breakdown:');
    const categories = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(quantity) as total_quantity
    FROM pantry_items
    GROUP BY category
    ORDER BY count DESC
  `).all();
    for (const cat of categories) {
        console.log(`[SEED]   - ${cat.category}: ${cat.count} items (${Math.round(cat.total_quantity * 10) / 10} total)`);
    }
    console.log('\n[SEED] Database seeded successfully!');
}
async function runSeed() {
    console.log('[SEED] Starting database seed...\n');
    try {
        (0, db_1.getDatabase)();
        clearDatabase();
        const itemIds = seedItems();
        seedActivities(itemIds);
        printSummary();
        (0, db_1.closeDatabase)();
        process.exit(0);
    }
    catch (error) {
        console.error('[SEED] Error seeding database:', error);
        (0, db_1.closeDatabase)();
        process.exit(1);
    }
}
if (require.main === module) {
    runSeed();
}
//# sourceMappingURL=seed.js.map