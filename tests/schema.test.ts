/**
 * Schema Validation Tests
 * Tests for Zod validation schemas
 * Priority: P0 - itemId required validation, request body validation
 */

import {
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
  createActivitySchema,
  scanResultSchema,
  paginationSchema,
} from '../src/models/validation';

describe('Validation Schemas', () => {
  // ============================================================================
  // Create Item Schema Tests (P0)
  // ============================================================================
  describe('createItemSchema', () => {
    it('should validate valid item data', () => {
      const validItem = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validItem);
      }
    });

    it('should reject empty name', () => {
      const invalidItem = {
        name: '',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Item name is required');
      }
    });

    it('should reject name exceeding max length', () => {
      const invalidItem = {
        name: 'A'.repeat(101),
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('less than 100 characters');
      }
    });

    it('should reject negative quantity', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: -1,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Quantity must be non-negative');
      }
    });

    it('should reject quantity exceeding max value', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 1000000,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Quantity exceeds maximum allowed value');
      }
    });

    it('should reject empty unit', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 5,
        unit: '',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Unit is required');
      }
    });

    it('should reject unit exceeding max length', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 5,
        unit: 'A'.repeat(21),
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('less than 20 characters');
      }
    });

    it('should reject empty category', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: '',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Category is required');
      }
    });

    it('should trim whitespace from string fields', () => {
      const itemWithWhitespace = {
        name: '  Apple  ',
        quantity: 5,
        unit: '  pieces  ',
        category: '  produce  ',
      };

      const result = createItemSchema.safeParse(itemWithWhitespace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Apple');
        expect(result.data.unit).toBe('pieces');
        expect(result.data.category).toBe('produce');
      }
    });

    it('should reject missing required fields', () => {
      const invalidItem = {
        name: 'Apple',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject null values', () => {
      const invalidItem = {
        name: null,
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should reject undefined required fields', () => {
      const invalidItem = {
        name: 'Apple',
        quantity: undefined,
        unit: 'pieces',
        category: 'produce',
      };

      const result = createItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Update Item Schema Tests
  // ============================================================================
  describe('updateItemSchema', () => {
    it('should validate partial update with name only', () => {
      const update = { name: 'New Name' };
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate partial update with quantity only', () => {
      const update = { quantity: 10 };
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate empty update object', () => {
      const update = {};
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity in update', () => {
      const update = { quantity: -5 };
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should reject empty name in update', () => {
      const update = { name: '' };
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace in update fields', () => {
      const update = { name: '  New Name  ' };
      const result = updateItemSchema.safeParse(update);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Name');
      }
    });
  });

  // ============================================================================
  // Item ID Schema Tests (P0) - itemId required validation
  // ============================================================================
  describe('itemIdSchema', () => {
    it('should validate valid UUID format', () => {
      const validId = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = itemIdSchema.safeParse(validId);
      expect(result.success).toBe(true);
    });

    it('should validate UUID with uppercase letters', () => {
      const validId = { id: '550E8400-E29B-41D4-A716-446655440000' };
      const result = itemIdSchema.safeParse(validId);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidId = { id: 'not-a-valid-uuid' };
      const result = itemIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid UUID format');
      }
    });

    it('should reject empty string as ID', () => {
      const invalidId = { id: '' };
      const result = itemIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
    });

    it('should reject missing ID field', () => {
      const invalidId = {};
      const result = itemIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
    });

    it('should reject null ID', () => {
      const invalidId = { id: null };
      const result = itemIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
    });

    it('should reject UUID with wrong version', () => {
      // Version 8 UUID (not 1-5)
      const invalidId = { id: '550e8400-e29b-81d4-a716-446655440000' };
      const result = itemIdSchema.safeParse(invalidId);
      expect(result.success).toBe(false);
    });

    it('should reject malformed UUIDs', () => {
      const malformedIds = [
        '550e8400-e29b-41d4-a716',  // truncated
        '550e8400e29b41d4a716446655440000',  // no dashes
        '550e8400-e29b-41d4-a716-44665544000g',  // invalid character
      ];

      malformedIds.forEach((id) => {
        const result = itemIdSchema.safeParse({ id });
        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // Create Activity Schema Tests (P0) - itemId required validation
  // ============================================================================
  describe('createActivitySchema', () => {
    it('should validate valid activity', () => {
      const validActivity = {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'ADD',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(validActivity);
      expect(result.success).toBe(true);
    });

    it('should require itemId field', () => {
      const invalidActivity = {
        type: 'ADD',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.path.includes('itemId'))).toBe(true);
      }
    });

    it('should validate itemId UUID format', () => {
      const invalidActivity = {
        itemId: 'invalid-item-id',
        type: 'ADD',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid item ID format');
      }
    });

    it('should reject empty itemId', () => {
      const invalidActivity = {
        itemId: '',
        type: 'ADD',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });

    it('should validate all activity types', () => {
      const validTypes = ['ADD', 'REMOVE', 'ADJUST'];

      validTypes.forEach((type) => {
        const activity = {
          itemId: '550e8400-e29b-41d4-a716-446655440000',
          type,
          amount: 5,
        };
        const result = createActivitySchema.safeParse(activity);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid activity type', () => {
      const invalidActivity = {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'INVALID',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const invalidActivity = {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'ADD',
        amount: -1,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Amount must be greater than 0');
      }
    });

    it('should reject zero amount', () => {
      const invalidActivity = {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'ADD',
        amount: 0,
      };

      const result = createActivitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });

    it('should default source to MANUAL', () => {
      const activity = {
        itemId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'ADD',
        amount: 5,
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe('MANUAL');
      }
    });

    it('should validate all source types', () => {
      const validSources = ['MANUAL', 'RECEIPT_SCAN', 'VISUAL_USAGE'];

      validSources.forEach((source) => {
        const activity = {
          itemId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'ADD',
          amount: 5,
          source,
        };
        const result = createActivitySchema.safeParse(activity);
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // Scan Result Schema Tests
  // ============================================================================
  describe('scanResultSchema', () => {
    it('should validate valid scan result', () => {
      const validResult = {
        name: 'Apple',
        quantity: 5,
      };

      const result = scanResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate scan result with optional fields', () => {
      const validResult = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const result = scanResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidResult = {
        name: '',
        quantity: 5,
      };

      const result = scanResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const invalidResult = {
        name: 'Apple',
        quantity: -1,
      };

      const result = scanResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Pagination Schema Tests
  // ============================================================================
  describe('paginationSchema', () => {
    it('should validate empty pagination (uses defaults)', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate custom page and limit', () => {
      const params = { page: '2', limit: '50' };
      const result = paginationSchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject page less than 1', () => {
      const params = { page: '0' };
      const result = paginationSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const params = { limit: '0' };
      const result = paginationSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const params = { limit: '101' };
      const result = paginationSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should handle non-numeric strings', () => {
      const params = { page: 'abc' };
      const result = paginationSchema.safeParse(params);
      // NaN becomes 0, which fails the min(1) check
      expect(result.success).toBe(false);
    });
  });
});
