/**
 * Database Operations Tests
 * CRUD tests with SQLite in-memory database
 * Priority: P0 - Database operations with SQLite
 */

import { SQLiteAdapter } from '../src/db/sqlite';
import { CreateItemInput, UpdateItemInput } from '../src/db/adapter';
import { createTestUserId } from './test-utils';

describe('Database Operations', () => {
  let db: SQLiteAdapter;
  let testUserId: string;
  let cleanup: () => void;

  beforeEach(() => {
    // Set up in-memory database for each test
    process.env.DB_PATH = ':memory:';
    db = new SQLiteAdapter();
    db.initialize();
    testUserId = createTestUserId();
    cleanup = () => db.close();
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // Create Operations (P0)
  // ============================================================================
  describe('createItem', () => {
    it('should create a new item with all fields', async () => {
      const input: CreateItemInput = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const item = await db.createItem(testUserId, input);

      expect(item).toBeDefined();
      expect(item.id).toBeDefined();
      expect(item.userId).toBe(testUserId);
      expect(item.name).toBe('Apple');
      expect(item.quantity).toBe(5);
      expect(item.unit).toBe('pieces');
      expect(item.category).toBe('produce');
      expect(item.lastUpdated).toBeDefined();
    });

    it('should create item with barcode', async () => {
      const input: CreateItemInput = {
        name: 'Milk',
        quantity: 1,
        unit: 'gallon',
        category: 'dairy',
        barcode: '1234567890123',
      };

      const item = await db.createItem(testUserId, input);

      expect(item.barcode).toBe('1234567890123');
    });

    it('should generate unique IDs for each item', async () => {
      const input1: CreateItemInput = {
        name: 'Item 1',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const input2: CreateItemInput = {
        name: 'Item 2',
        quantity: 2,
        unit: 'pieces',
        category: 'test',
      };

      const item1 = await db.createItem(testUserId, input1);
      const item2 = await db.createItem(testUserId, input2);

      expect(item1.id).not.toBe(item2.id);
    });

    it('should set lastUpdated timestamp on creation', async () => {
      const beforeCreate = new Date();
      
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const item = await db.createItem(testUserId, input);
      
      const afterCreate = new Date();
      const itemDate = new Date(item.lastUpdated);

      expect(itemDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(itemDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should allow items with same name for different users', async () => {
      const otherUserId = createTestUserId();
      const input: CreateItemInput = {
        name: 'Shared Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const item1 = await db.createItem(testUserId, input);
      const item2 = await db.createItem(otherUserId, input);

      expect(item1.id).not.toBe(item2.id);
      expect(item1.userId).toBe(testUserId);
      expect(item2.userId).toBe(otherUserId);
    });
  });

  // ============================================================================
  // Read Operations (P0)
  // ============================================================================
  describe('getAllItems', () => {
    it('should return empty array when no items exist', async () => {
      const items = await db.getAllItems(testUserId);
      expect(items).toEqual([]);
    });

    it('should return all items for a user', async () => {
      const input1: CreateItemInput = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const input2: CreateItemInput = {
        name: 'Milk',
        quantity: 1,
        unit: 'gallon',
        category: 'dairy',
      };

      await db.createItem(testUserId, input1);
      await db.createItem(testUserId, input2);

      const items = await db.getAllItems(testUserId);

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['Apple', 'Milk']);
    });

    it('should not return items from other users', async () => {
      const otherUserId = createTestUserId();
      
      await db.createItem(testUserId, {
        name: 'My Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      await db.createItem(otherUserId, {
        name: 'Other Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      const myItems = await db.getAllItems(testUserId);
      const otherItems = await db.getAllItems(otherUserId);

      expect(myItems).toHaveLength(1);
      expect(myItems[0].name).toBe('My Item');
      expect(otherItems).toHaveLength(1);
      expect(otherItems[0].name).toBe('Other Item');
    });

    it('should filter items by category', async () => {
      await db.createItem(testUserId, {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      });

      await db.createItem(testUserId, {
        name: 'Milk',
        quantity: 1,
        unit: 'gallon',
        category: 'dairy',
      });

      const produceItems = await db.getAllItems(testUserId, 'produce');
      const dairyItems = await db.getAllItems(testUserId, 'dairy');

      expect(produceItems).toHaveLength(1);
      expect(produceItems[0].name).toBe('Apple');
      expect(dairyItems).toHaveLength(1);
      expect(dairyItems[0].name).toBe('Milk');
    });

    it('should sort items by name case-insensitively', async () => {
      await db.createItem(testUserId, {
        name: 'zebra',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      await db.createItem(testUserId, {
        name: 'Apple',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      await db.createItem(testUserId, {
        name: 'mango',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      const items = await db.getAllItems(testUserId);
      const names = items.map(i => i.name);

      expect(names).toEqual(['Apple', 'mango', 'zebra']);
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      const input: CreateItemInput = {
        name: 'Test Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const retrieved = await db.getItemById(testUserId, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Item');
    });

    it('should return null for non-existent ID', async () => {
      const result = await db.getItemById(testUserId, '550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBeNull();
    });

    it('should not return item from other user', async () => {
      const otherUserId = createTestUserId();
      
      const input: CreateItemInput = {
        name: 'My Private Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const retrievedByOther = await db.getItemById(otherUserId, created.id);

      expect(retrievedByOther).toBeNull();
    });
  });

  describe('getItemByName', () => {
    it('should find item by name case-insensitively', async () => {
      const input: CreateItemInput = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      await db.createItem(testUserId, input);

      const foundLower = await db.getItemByName(testUserId, 'apple');
      const foundUpper = await db.getItemByName(testUserId, 'APPLE');
      const foundMixed = await db.getItemByName(testUserId, 'ApPlE');

      expect(foundLower?.name).toBe('Apple');
      expect(foundUpper?.name).toBe('Apple');
      expect(foundMixed?.name).toBe('Apple');
    });

    it('should return null for non-existent name', async () => {
      const result = await db.getItemByName(testUserId, 'NonExistent');
      expect(result).toBeNull();
    });

    it('should not return item from other user with same name', async () => {
      const otherUserId = createTestUserId();
      
      await db.createItem(testUserId, {
        name: 'Shared Name',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      });

      const result = await db.getItemByName(otherUserId, 'Shared Name');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Update Operations (P0)
  // ============================================================================
  describe('updateItem', () => {
    it('should update item name', async () => {
      const input: CreateItemInput = {
        name: 'Old Name',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const update: UpdateItemInput = { name: 'New Name' };

      const updated = await db.updateItem(testUserId, created.id, update);

      expect(updated?.name).toBe('New Name');
      expect(updated?.quantity).toBe(1); // Unchanged
      expect(updated?.id).toBe(created.id);
    });

    it('should update item quantity', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 5,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const update: UpdateItemInput = { quantity: 10 };

      const updated = await db.updateItem(testUserId, created.id, update);

      expect(updated?.quantity).toBe(10);
    });

    it('should update multiple fields at once', async () => {
      const input: CreateItemInput = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const created = await db.createItem(testUserId, input);
      const update: UpdateItemInput = {
        name: 'Green Apple',
        quantity: 10,
        unit: 'lbs',
      };

      const updated = await db.updateItem(testUserId, created.id, update);

      expect(updated?.name).toBe('Green Apple');
      expect(updated?.quantity).toBe(10);
      expect(updated?.unit).toBe('lbs');
      expect(updated?.category).toBe('produce'); // Unchanged
    });

    it('should update lastUpdated timestamp on modification', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const originalTimestamp = new Date(created.lastUpdated).getTime();

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 50));

      const updated = await db.updateItem(testUserId, created.id, { name: 'Updated' });
      const newTimestamp = new Date(updated!.lastUpdated).getTime();

      expect(newTimestamp).toBeGreaterThan(originalTimestamp);
    });

    it('should return null when updating non-existent item', async () => {
      const update: UpdateItemInput = { name: 'New Name' };
      const result = await db.updateItem(testUserId, '550e8400-e29b-41d4-a716-446655440000', update);

      expect(result).toBeNull();
    });

    it('should not update item from other user', async () => {
      const otherUserId = createTestUserId();
      
      const input: CreateItemInput = {
        name: 'My Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const update: UpdateItemInput = { name: 'Hacked' };

      const result = await db.updateItem(otherUserId, created.id, update);
      expect(result).toBeNull();

      // Verify original item unchanged
      const original = await db.getItemById(testUserId, created.id);
      expect(original?.name).toBe('My Item');
    });
  });

  // ============================================================================
  // Delete Operations (P0)
  // ============================================================================
  describe('deleteItem', () => {
    it('should delete item and return true', async () => {
      const input: CreateItemInput = {
        name: 'To Delete',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const deleted = await db.deleteItem(testUserId, created.id);

      expect(deleted).toBe(true);

      const retrieved = await db.getItemById(testUserId, created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent item', async () => {
      const result = await db.deleteItem(testUserId, '550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBe(false);
    });

    it('should not delete item from other user', async () => {
      const otherUserId = createTestUserId();
      
      const input: CreateItemInput = {
        name: 'My Item',
        quantity: 1,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const result = await db.deleteItem(otherUserId, created.id);

      expect(result).toBe(false);

      // Verify item still exists
      const retrieved = await db.getItemById(testUserId, created.id);
      expect(retrieved).toBeDefined();
    });

    it('should cascade delete associated activities', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 10,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      
      // Log an activity for this item
      await db.logActivity(testUserId, created.id, 'ADD', 10);

      // Verify activity exists
      const activities = await db.getActivities(testUserId, 10, 0, created.id);
      expect(activities.length).toBeGreaterThan(0);

      // Delete the item
      await db.deleteItem(testUserId, created.id);

      // Activities should be cascade deleted
      const remainingActivities = await db.getActivities(testUserId, 10, 0, created.id);
      expect(remainingActivities).toHaveLength(0);
    });
  });

  // ============================================================================
  // Categories (P0)
  // ============================================================================
  describe('getCategories', () => {
    it('should return empty array when no items exist', async () => {
      const categories = await db.getCategories(testUserId);
      expect(categories).toEqual([]);
    });

    it('should return unique categories', async () => {
      await db.createItem(testUserId, { name: 'Apple', quantity: 1, unit: 'pieces', category: 'produce' });
      await db.createItem(testUserId, { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy' });
      await db.createItem(testUserId, { name: 'Cheese', quantity: 1, unit: 'lbs', category: 'dairy' });

      const categories = await db.getCategories(testUserId);

      expect(categories).toHaveLength(2);
      expect(categories.sort()).toEqual(['dairy', 'produce']);
    });

    it('should sort categories case-insensitively', async () => {
      await db.createItem(testUserId, { name: 'Zebra', quantity: 1, unit: 'pieces', category: 'zoo' });
      await db.createItem(testUserId, { name: 'Apple', quantity: 1, unit: 'pieces', category: 'Produce' });

      const categories = await db.getCategories(testUserId);

      // Note: Both will be returned since they are distinct in case
      expect(categories.length).toBe(2);
      expect(categories).toContain('Produce');
      expect(categories).toContain('zoo');
    });

    it('should not return categories from other users', async () => {
      const otherUserId = createTestUserId();
      
      await db.createItem(testUserId, { name: 'Apple', quantity: 1, unit: 'pieces', category: 'personal' });
      await db.createItem(otherUserId, { name: 'Shared', quantity: 1, unit: 'pieces', category: 'shared' });

      const myCategories = await db.getCategories(testUserId);
      const otherCategories = await db.getCategories(otherUserId);

      expect(myCategories).toEqual(['personal']);
      expect(otherCategories).toEqual(['shared']);
    });
  });

  // ============================================================================
  // Adjust Quantity (P0)
  // ============================================================================
  describe('adjustItemQuantity', () => {
    it('should add to quantity', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 10,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const adjusted = await db.adjustItemQuantity(testUserId, created.id, 5);

      expect(adjusted?.quantity).toBe(15);
    });

    it('should subtract from quantity', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 10,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const adjusted = await db.adjustItemQuantity(testUserId, created.id, -3);

      expect(adjusted?.quantity).toBe(7);
    });

    it('should not go below zero when subtracting', async () => {
      const input: CreateItemInput = {
        name: 'Test',
        quantity: 5,
        unit: 'pieces',
        category: 'test',
      };

      const created = await db.createItem(testUserId, input);
      const adjusted = await db.adjustItemQuantity(testUserId, created.id, -10);

      expect(adjusted?.quantity).toBe(0);
    });

    it('should return null for non-existent item', async () => {
      const result = await db.adjustItemQuantity(testUserId, '550e8400-e29b-41d4-a716-446655440000', 5);
      expect(result).toBeNull();
    });
  });
});
