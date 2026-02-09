/**
 * Database Seed Script
 * Populates the database with sample data for development and testing
 * Run with: npm run seed
 */

import { getDatabase, closeDatabase, createItem, logActivity } from '../db';
import { ActivityType, ActivitySource } from '../models/types';

// ============================================================================
// Configuration
// ============================================================================

const DB_TYPE = process.env.DB_TYPE || 'sqlite';
// Default seed user ID (for development)
const SEED_USER_ID = process.env.SEED_USER_ID || 'seed_user_test_123';

// ============================================================================
// Sample Data
// ============================================================================

const sampleItems = [
  // Produce
  { name: 'Organic Bananas', quantity: 6, unit: 'pieces', category: 'produce' },
  { name: 'Gala Apples', quantity: 4, unit: 'pieces', category: 'produce' },
  { name: 'Avocados', quantity: 3, unit: 'pieces', category: 'produce' },
  { name: 'Roma Tomatoes', quantity: 5, unit: 'pieces', category: 'produce' },
  { name: 'Yellow Onions', quantity: 3, unit: 'pieces', category: 'produce' },
  { name: 'Garlic', quantity: 1, unit: 'bulb', category: 'produce' },
  { name: 'Fresh Spinach', quantity: 1, unit: 'bag', category: 'produce' },
  { name: 'Broccoli', quantity: 2, unit: 'heads', category: 'produce' },
  { name: 'Carrots', quantity: 1, unit: 'lbs', category: 'produce' },
  
  // Dairy
  { name: 'Whole Milk', quantity: 1, unit: 'gallon', category: 'dairy' },
  { name: 'Large Eggs', quantity: 12, unit: 'pieces', category: 'dairy' },
  { name: 'Cheddar Cheese', quantity: 0.5, unit: 'lbs', category: 'dairy' },
  { name: 'Greek Yogurt', quantity: 4, unit: 'cups', category: 'dairy' },
  { name: 'Butter', quantity: 1, unit: 'sticks', category: 'dairy' },
  { name: 'Heavy Cream', quantity: 1, unit: 'pint', category: 'dairy' },
  
  // Pantry
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
  
  // Meat
  { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'meat' },
  { name: 'Ground Beef', quantity: 1, unit: 'lbs', category: 'meat' },
  { name: 'Bacon', quantity: 1, unit: 'pack', category: 'meat' },
  { name: 'Salmon Fillet', quantity: 1, unit: 'lbs', category: 'meat' },
  
  // Bakery
  { name: 'Sandwich Bread', quantity: 1, unit: 'loaf', category: 'bakery' },
  { name: 'Bagels', quantity: 6, unit: 'pieces', category: 'bakery' },
  { name: 'Flour Tortillas', quantity: 8, unit: 'pieces', category: 'bakery' },
  
  // Beverages
  { name: 'Sparkling Water', quantity: 12, unit: 'cans', category: 'beverages' },
  { name: 'Coffee Beans', quantity: 12, unit: 'oz', category: 'beverages' },
  { name: 'Orange Juice', quantity: 64, unit: 'oz', category: 'beverages' },
  
  // Frozen
  { name: 'Frozen Broccoli', quantity: 1, unit: 'bag', category: 'frozen' },
  { name: 'Ice Cream', quantity: 1, unit: 'pint', category: 'frozen' },
  { name: 'Frozen Pizza', quantity: 2, unit: 'pieces', category: 'frozen' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clear existing data and reset database
 */
async function clearDatabase(): Promise<void> {
  const database = getDatabase();
  
  console.log('[SEED] Clearing existing data...');
  
  if (DB_TYPE === 'sqlite') {
    await database.execute('PRAGMA foreign_keys = OFF;');
    await database.execute('DELETE FROM activities;');
    await database.execute('DELETE FROM pantry_items;');
    await database.execute('VACUUM;');
    await database.execute('PRAGMA foreign_keys = ON;');
  } else {
    // PostgreSQL
    await database.execute('TRUNCATE activities, pantry_items CASCADE;');
  }
  
  console.log('[SEED] Database cleared');
}

/**
 * Seed pantry items
 */
async function seedItems(): Promise<string[]> {
  console.log(`[SEED] Creating ${sampleItems.length} pantry items for user ${SEED_USER_ID}...`);
  
  const itemIds: string[] = [];
  
  for (const item of sampleItems) {
    const created = await createItem(SEED_USER_ID, item);
    itemIds.push(created.id);
  }
  
  console.log(`[SEED] Created ${itemIds.length} items`);
  return itemIds;
}

/**
 * Seed activities for realistic data
 */
async function seedActivities(itemIds: string[]): Promise<void> {
  console.log('[SEED] Creating sample activities...');
  
  const activities: Array<{
    itemId: string;
    type: ActivityType;
    amount: number;
    source: ActivitySource;
  }> = [];
  
  // Add some manual activities (ADD and REMOVE)
  const itemsForActivities = itemIds.slice(0, 15);
  
  for (const itemId of itemsForActivities) {
    // 60% chance of an ADD activity
    if (Math.random() > 0.4) {
      activities.push({
        itemId,
        type: 'ADD',
        amount: Math.floor(Math.random() * 5) + 1,
        source: 'MANUAL',
      });
    }
    
    // 30% chance of a REMOVE activity
    if (Math.random() > 0.7) {
      activities.push({
        itemId,
        type: 'REMOVE',
        amount: Math.floor(Math.random() * 3) + 1,
        source: Math.random() > 0.5 ? 'VISUAL_USAGE' : 'MANUAL',
      });
    }
  }
  
  // Add some receipt scan activities
  const receiptItems = itemIds.slice(15, 20);
  for (const itemId of receiptItems) {
    activities.push({
      itemId,
      type: 'ADD',
      amount: Math.floor(Math.random() * 3) + 1,
      source: 'RECEIPT_SCAN',
    });
  }
  
  // Log all activities
  let successCount = 0;
  for (const activity of activities) {
    const logged = await logActivity(
      SEED_USER_ID,
      activity.itemId,
      activity.type,
      activity.amount,
      activity.source
    );
    if (logged) successCount++;
  }
  
  console.log(`[SEED] Created ${successCount} activities`);
}

/**
 * Print summary statistics
 */
async function printSummary(): Promise<void> {
  const database = getDatabase();
  
  const itemResult = await database.query('SELECT COUNT(*) as count FROM pantry_items') as any[];
  const activityResult = await database.query('SELECT COUNT(*) as count FROM activities') as any[];
  const categoryResult = await database.query('SELECT COUNT(DISTINCT category) as count FROM pantry_items') as any[];
  
  const itemCount = parseInt(itemResult[0].count, 10);
  const activityCount = parseInt(activityResult[0].count, 10);
  const categoryCount = parseInt(categoryResult[0].count, 10);
  
  console.log('\n[SEED] ===========================================');
  console.log('[SEED] Seed Summary');
  console.log('[SEED] ===========================================');
  console.log(`[SEED] User ID:          ${SEED_USER_ID}`);
  console.log(`[SEED] Total Items:      ${itemCount}`);
  console.log(`[SEED] Total Activities: ${activityCount}`);
  console.log(`[SEED] Categories:       ${categoryCount}`);
  console.log('[SEED] ===========================================\n');
  
  // Show category breakdown
  console.log('[SEED] Category Breakdown:');
  const categories = await database.query(`
    SELECT category, COUNT(*) as count, SUM(quantity) as total_quantity
    FROM pantry_items
    WHERE user_id = ?
    GROUP BY category
    ORDER BY count DESC
  `, [SEED_USER_ID]) as Array<{ category: string; count: string; total_quantity: string }>;
  
  for (const cat of categories) {
    console.log(`[SEED]   - ${cat.category}: ${cat.count} items (${Math.round(parseFloat(cat.total_quantity) * 10) / 10} total)`);
  }
  
  console.log('\n[SEED] Database seeded successfully!');
}

// ============================================================================
// Main Execution
// ============================================================================

async function runSeed(): Promise<void> {
  console.log('[SEED] Starting database seed...\n');
  
  try {
    // Initialize database connection
    getDatabase();
    
    // Clear existing data
    await clearDatabase();
    
    // Seed items
    const itemIds = await seedItems();
    
    // Seed activities
    await seedActivities(itemIds);
    
    // Print summary
    await printSummary();
    
    // Close connection
    closeDatabase();
    
    process.exit(0);
  } catch (error) {
    console.error('[SEED] Error seeding database:', error);
    closeDatabase();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeed();
}

export { runSeed };
