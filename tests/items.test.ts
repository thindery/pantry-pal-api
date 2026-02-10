/**
 * Items API Route Tests
 * POST /api/items validation and route tests
 * Priority: P0 - Request body validation, error cases
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// Mock the database module
jest.mock('../src/db/operations', () => ({
  getAllItems: jest.fn(),
  getItemById: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  getCategories: jest.fn(),
}));

// Mock the auth middleware
jest.mock('../src/middleware/auth', () => ({
  requireAuth: jest.fn((req: Request, _res: Response, next: NextFunction) => {
    req.userId = 'test_user_123456';
    next();
  }),
}));

// Import mocked functions after jest.mock
import {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
} from '../src/db/operations';

// Import routers after mocking
import itemsRouter from '../src/routes/items';

describe('Items API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/items', itemsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // POST /api/items Validation Tests (P0)
  // ============================================================================
  describe('POST /api/items - Validation', () => {
    const validItem = {
      name: 'Apple',
      quantity: 5,
      unit: 'pieces',
      category: 'produce',
    };

    it('should create item with valid data', async () => {
      const createdItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'test_user_123456',
        ...validItem,
        lastUpdated: new Date().toISOString(),
      };

      (createItem as jest.Mock).mockResolvedValue(createdItem);

      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe('Apple');
      expect(createItem).toHaveBeenCalledWith('test_user_123456', validItem);
    });

    it('should return 400 for missing name', async () => {
      const invalidItem = {
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors[0].path).toContain('name');
    });

    it('should return 400 for empty name', async () => {
      const invalidItem = {
        ...validItem,
        name: '',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors[0].message).toContain('required');
    });

    it('should return 400 for name exceeding max length', async () => {
      const invalidItem = {
        ...validItem,
        name: 'A'.repeat(101),
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].message).toContain('less than 100 characters');
    });

    it('should return 400 for negative quantity', async () => {
      const invalidItem = {
        ...validItem,
        quantity: -1,
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].message).toBe('Quantity must be non-negative');
    });

    it('should return 400 for quantity exceeding max value', async () => {
      const invalidItem = {
        ...validItem,
        quantity: 1000000,
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].message).toBe('Quantity exceeds maximum allowed value');
    });

    it('should return 400 for missing unit', async () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 5,
        category: 'produce',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].path).toContain('unit');
    });

    it('should return 400 for empty unit', async () => {
      const invalidItem = {
        ...validItem,
        unit: '',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
    });

    it('should return 400 for unit exceeding max length', async () => {
      const invalidItem = {
        ...validItem,
        unit: 'A'.repeat(21),
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].message).toContain('less than 20 characters');
    });

    it('should return 400 for missing category', async () => {
      const invalidItem = {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].path).toContain('category');
    });

    it('should return 400 for empty category', async () => {
      const invalidItem = {
        ...validItem,
        category: '',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
    });

    it('should return 400 for category exceeding max length', async () => {
      const invalidItem = {
        ...validItem,
        category: 'A'.repeat(51),
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors[0].message).toContain('less than 50 characters');
    });

    it('should return 400 for null values', async () => {
      const invalidItem = {
        ...validItem,
        name: null,
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
    });

    it('should return 400 for incorrect data types', async () => {
      const invalidItem = {
        ...validItem,
        quantity: 'five',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
    });

    it('should return 400 with all validation errors for invalid request', async () => {
      const invalidItem = {
        name: '',
        quantity: -5,
        unit: '',
        category: '',
      };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.details.errors.length).toBeGreaterThan(1);
    });

    it('should return 500 for database errors', async () => {
      (createItem as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should trim whitespace from input fields', async () => {
      const itemWithWhitespace = {
        name: '  Apple  ',
        quantity: 5,
        unit: '  pieces  ',
        category: '  produce  ',
      };

      const createdItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'test_user_123456',
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
        lastUpdated: new Date().toISOString(),
      };

      (createItem as jest.Mock).mockResolvedValue(createdItem);

      await request(app)
        .post('/api/items')
        .send(itemWithWhitespace)
        .set('Authorization', 'Bearer test_token');

      expect(createItem).toHaveBeenCalledWith('test_user_123456', {
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
      });
    });
  });

  // ============================================================================
  // GET /api/items Tests
  // ============================================================================
  describe('GET /api/items', () => {
    it('should return all items for user', async () => {
      const items = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'test_user_123456',
          name: 'Apple',
          quantity: 5,
          unit: 'pieces',
          category: 'produce',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          userId: 'test_user_123456',
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          lastUpdated: new Date().toISOString(),
        },
      ];

      (getAllItems as jest.Mock).mockResolvedValue(items);

      const response = await request(app)
        .get('/api/items')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(items);
      expect(getAllItems).toHaveBeenCalledWith('test_user_123456', undefined);
    });

    it('should filter items by category', async () => {
      const items = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'test_user_123456',
          name: 'Apple',
          quantity: 5,
          unit: 'pieces',
          category: 'produce',
          lastUpdated: new Date().toISOString(),
        },
      ];

      (getAllItems as jest.Mock).mockResolvedValue(items);

      const response = await request(app)
        .get('/api/items?category=produce')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(getAllItems).toHaveBeenCalledWith('test_user_123456', 'produce');
    });

    it('should return empty array when no items', async () => {
      (getAllItems as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/items')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 500 for database errors', async () => {
      (getAllItems as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/items')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // GET /api/items/:id Tests
  // ============================================================================
  describe('GET /api/items/:id', () => {
    it('should return item by valid ID', async () => {
      const item = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'test_user_123456',
        name: 'Apple',
        quantity: 5,
        unit: 'pieces',
        category: 'produce',
        lastUpdated: new Date().toISOString(),
      };

      (getItemById as jest.Mock).mockResolvedValue(item);

      const response = await request(app)
        .get('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(item);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/items/invalid-id')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid item ID format');
    });

    it('should return 404 for non-existent item', async () => {
      (getItemById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================================
  // GET /api/items/categories Tests
  // ============================================================================
  describe('GET /api/items/categories', () => {
    it('should return all categories', async () => {
      const categories = ['produce', 'dairy', 'pantry'];

      (getCategories as jest.Mock).mockResolvedValue(categories);

      const response = await request(app)
        .get('/api/items/categories')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(categories);
    });
  });

  // ============================================================================
  // PUT /api/items/:id Tests
  // ============================================================================
  describe('PUT /api/items/:id', () => {
    it('should update item with valid data', async () => {
      const updatedItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'test_user_123456',
        name: 'Updated Apple',
        quantity: 10,
        unit: 'lbs',
        category: 'produce',
        lastUpdated: new Date().toISOString(),
      };

      (updateItem as jest.Mock).mockResolvedValue(updatedItem);

      const response = await request(app)
        .put('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Apple', quantity: 10, unit: 'lbs' })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedItem);
    });

    it('should return 400 for invalid item ID', async () => {
      const response = await request(app)
        .put('/api/items/invalid-id')
        .send({ name: 'Updated' })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .put('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .send({ quantity: -5 })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty update body', async () => {
      const response = await request(app)
        .put('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .send({})
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('At least one field');
    });

    it('should return 404 for non-existent item', async () => {
      (updateItem as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated' })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================================
  // DELETE /api/items/:id Tests
  // ============================================================================
  describe('DELETE /api/items/:id', () => {
    it('should delete item and return success', async () => {
      (deleteItem as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
    });

    it('should return 400 for invalid item ID', async () => {
      const response = await request(app)
        .delete('/api/items/invalid-id')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent item', async () => {
      (deleteItem as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/items/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================================
  // Error Response Format Tests
  // ============================================================================
  describe('Error Response Format', () => {
    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({})
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.meta.timestamp).toBeDefined();
      expect(new Date(response.body.meta.timestamp).getTime()).not.toBeNaN();
    });

    it('should include error code in error responses', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({})
        .set('Authorization', 'Bearer test_token');

      expect(response.body.error.code).toBeDefined();
    });

    it('should include error details for validation errors', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({})
        .set('Authorization', 'Bearer test_token');

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.errors).toBeInstanceOf(Array);
    });
  });
});
