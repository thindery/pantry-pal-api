#!/usr/bin/env ts-node
/**
 * Migration Script: SQLite to PostgreSQL
 * 
 * This script migrates data from SQLite to PostgreSQL
 * Usage: npx ts-node scripts/migrate-sqlite-to-postgres.ts
 * 
 * Prerequisites:
 * - PostgreSQL database must be running
 * - DATABASE_URL or DB_* environment variables must be set for PostgreSQL
 * - SQLite database must exist at DB_PATH (default: ./data/pantry.db)
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// SQLite configuration
const SQLITE_PATH = process.env.DB_PATH || './data/pantry.db';

// PostgreSQL configuration (use DATABASE_URL if available, otherwise individual vars)
const DATABASE_URL = process.env.DATABASE_URL;
const PG_CONFIG = DATABASE_URL ? { connectionString: DATABASE_URL } : {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'pantry_pal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function migrate() {
  console.log('='.repeat(60));
  console.log('SQLite to PostgreSQL Migration');
  console.log('='.repeat(60));
  console.log();

  // Connect to SQLite
  console.log('[SQLite] Connecting to:', SQLITE_PATH);
  const sqlite = new Database(SQLITE_PATH);
  console.log('[SQLite] Connected successfully');

  // Connect to PostgreSQL
  console.log('[PostgreSQL] Connecting...');
  const pgPool = new Pool(PG_CONFIG);
  const pgClient = await pgPool.connect();
  console.log('[PostgreSQL] Connected successfully');
  console.log();

  try {
    // Get counts from SQLite
    const sqliteItemCount = (sqlite.prepare('SELECT COUNT(*) as count FROM pantry_items').get() as { count: number }).count;
    const sqliteActivityCount = (sqlite.prepare('SELECT COUNT(*) as count FROM activities').get() as { count: number }).count;
    const sqliteProductCount = (sqlite.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;

    console.log('[SQLite] Data counts:');
    console.log(`  - Pantry Items: ${sqliteItemCount}`);
    console.log(`  - Activities: ${sqliteActivityCount}`);
    console.log(`  - Products: ${sqliteProductCount}`);
    console.log();

    // Verify PostgreSQL tables exist
    const tablesExist = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pantry_items'
      );
    `);

    if (!tablesExist.rows[0].exists) {
      console.error('[Error] PostgreSQL tables do not exist. Please run migrations first:');
      console.error('  npm run db:migrate');
      process.exit(1);
    }

    // Clear existing data from PostgreSQL (optional - add --preserve flag to skip)
    const preserve = process.argv.includes('--preserve');
    if (!preserve) {
      console.log('[PostgreSQL] Clearing existing data...');
      await pgClient.query('DELETE FROM activities;');
      await pgClient.query('DELETE FROM pantry_items;');
      await pgClient.query('DELETE FROM products;');
      console.log('[PostgreSQL] Existing data cleared');
    }
    console.log();

    // Migrate pantry_items
    console.log('[Migrating] Pantry items...');
    const items = sqlite.prepare('SELECT * FROM pantry_items').all() as any[];
    for (const item of items) {
      await pgClient.query(`
        INSERT INTO pantry_items (id, user_id, name, barcode, quantity, unit, category, last_updated, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          barcode = EXCLUDED.barcode,
          quantity = EXCLUDED.quantity,
          unit = EXCLUDED.unit,
          category = EXCLUDED.category,
          last_updated = EXCLUDED.last_updated
      `, [
        item.id,
        item.user_id || 'seed_user_test_123', // fallback for items without user_id
        item.name,
        item.barcode,
        item.quantity,
        item.unit,
        item.category,
        item.last_updated,
        item.created_at || new Date().toISOString()
      ]);
    }
    console.log(`  ✓ Migrated ${items.length} pantry items`);

    // Migrate activities
    console.log('[Migrating] Activities...');
    const activities = sqlite.prepare('SELECT * FROM activities').all() as any[];
    for (const activity of activities) {
      await pgClient.query(`
        INSERT INTO activities (id, user_id, item_id, item_name, type, amount, timestamp, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          item_id = EXCLUDED.item_id,
          item_name = EXCLUDED.item_name,
          type = EXCLUDED.type,
          amount = EXCLUDED.amount,
          timestamp = EXCLUDED.timestamp,
          source = EXCLUDED.source
      `, [
        activity.id,
        activity.user_id || 'seed_user_test_123',
        activity.item_id,
        activity.item_name,
        activity.type,
        activity.amount,
        activity.timestamp,
        activity.source || 'MANUAL'
      ]);
    }
    console.log(`  ✓ Migrated ${activities.length} activities`);

    // Migrate products (barcode cache)
    console.log('[Migrating] Products...');
    const products = sqlite.prepare('SELECT * FROM products').all() as any[];
    for (const product of products) {
      await pgClient.query(`
        INSERT INTO products (
          id, barcode, name, brand, category, description, ingredients, 
          nutrition_facts, image_url, source, api_response, 
          created_at, updated_at, info_last_synced
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (barcode) DO UPDATE SET
          name = EXCLUDED.name,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          ingredients = EXCLUDED.ingredients,
          nutrition_facts = EXCLUDED.nutrition_facts,
          image_url = EXCLUDED.image_url,
          source = EXCLUDED.source,
          api_response = EXCLUDED.api_response,
          updated_at = EXCLUDED.updated_at,
          info_last_synced = EXCLUDED.info_last_synced
      `, [
        product.id || crypto.randomUUID(),
        product.barcode,
        product.name,
        product.brand,
        product.category,
        product.description,
        product.ingredients,
        product.nutrition_facts,
        product.image_url,
        product.source || 'live',
        product.api_response,
        product.created_at || new Date().toISOString(),
        product.updated_at || new Date().toISOString(),
        product.info_last_synced || product.updated_at || new Date().toISOString()
      ]);
    }
    console.log(`  ✓ Migrated ${products.length} products`);

    // Verify migration
    console.log();
    console.log('[Verification] PostgreSQL data counts:');
    const pgItemCount = (await pgClient.query('SELECT COUNT(*) FROM pantry_items')).rows[0].count;
    const pgActivityCount = (await pgClient.query('SELECT COUNT(*) FROM activities')).rows[0].count;
    const pgProductCount = (await pgClient.query('SELECT COUNT(*) FROM products')).rows[0].count;

    console.log(`  - Pantry Items: ${pgItemCount} (was ${sqliteItemCount})`);
    console.log(`  - Activities: ${pgActivityCount} (was ${sqliteActivityCount})`);
    console.log(`  - Products: ${pgProductCount} (was ${sqliteProductCount})`);
    console.log();

    // Check for discrepancies
    const itemDiff = parseInt(pgItemCount) - sqliteItemCount;
    const activityDiff = parseInt(pgActivityCount) - sqliteActivityCount;
    const productDiff = parseInt(pgProductCount) - sqliteProductCount;

    if (itemDiff === 0 && activityDiff === 0 && productDiff === 0) {
      console.log('✅ Migration completed successfully! All counts match.');
    } else {
      console.log('⚠️  Migration completed with differences:');
      if (itemDiff !== 0) console.log(`   - Pantry Items: ${itemDiff > 0 ? '+' : ''}${itemDiff}`);
      if (activityDiff !== 0) console.log(`   - Activities: ${activityDiff > 0 ? '+' : ''}${activityDiff}`);
      if (productDiff !== 0) console.log(`   - Products: ${productDiff > 0 ? '+' : ''}${productDiff}`);
    }

  } catch (error) {
    console.error('[Error] Migration failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    pgClient.release();
    await pgPool.end();
    sqlite.close();
    console.log();
    console.log('[Cleanup] Connections closed');
  }
}

// Run migration
migrate().catch((error) => {
  console.error('[Fatal Error]', error);
  process.exit(1);
});
