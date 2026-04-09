/**
 * Sessions API Route Tests (REMY-285)
 * Tests for POST /sessions, GET /sessions/:id, PATCH /sessions/:id,
 * POST /sessions/:id/capture, GET /sessions/:id/receipts
 * Priority: P0 - Request body validation, error cases
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// Mock the database module
jest.mock('../src/db', () => ({
  getDatabase: jest.fn(),
}));

// Mock the auth middleware
jest.mock('../src/middleware/auth', () => ({
  requireAuth: jest.fn((req: Request, _res: Response, next: NextFunction) => {
    req.userId = 'test_user_123456';
    next();
  }),
}));

// Import mocked functions after jest.mock
import { getDatabase } from '../src/db';
import { SessionReceipt } from '../src/models/shoppingSession';

// Import router after mocking
import sessionsRouter from '../src/routes/sessions';

describe('Sessions API Routes', () => {
  let app: express.Application;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      createSession: jest.fn(),
      getSessionById: jest.fn(),
      getUserSessions: jest.fn(),
      addSessionItem: jest.fn(),
      captureSessionReceipt: jest.fn(),
      getSessionReceipts: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // POST /sessions Tests
  // ============================================================================
  describe('POST /api/sessions - Create Session', () => {
    it('should create a new shopping session', async () => {
      const newSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'test_user_123456',
        storeName: 'Whole Foods',
        notes: 'Weekly grocery run',
        startedAt: new Date().toISOString(),
        status: 'active',
        totalAmount: 0,
        itemCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.createSession.mockResolvedValue(newSession);

      const response = await request(app)
        .post('/api/sessions')
        .send({ storeName: 'Whole Foods', notes: 'Weekly grocery run' })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.storeName).toBe('Whole Foods');
      expect(mockDb.createSession).toHaveBeenCalledWith('test_user_123456', {
        storeName: 'Whole Foods',
        notes: 'Weekly grocery run',
      });
    });

    it('should create session without optional fields', async () => {
      const newSession = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'test_user_123456',
        startedAt: new Date().toISOString(),
        status: 'active',
        totalAmount: 0,
        itemCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.createSession.mockResolvedValue(newSession);

      const response = await request(app)
        .post('/api/sessions')
        .send({})
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockDb.createSession).toHaveBeenCalledWith('test_user_123456', {});
    });

    it('should return 400 for storeName too long', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({ storeName: 'a'.repeat(101) })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for notes too long', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({ notes: 'a'.repeat(501) })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // GET /sessions/:id Tests
  // ============================================================================
  describe('GET /api/sessions/:id - Get Session', () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'test_user_123456',
      storeName: 'Whole Foods',
      startedAt: new Date().toISOString(),
      status: 'active',
      totalAmount: 45.99,
      itemCount: 3,
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Apples',
          quantity: 2,
          price: 3.99,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Milk',
          quantity: 1,
          price: 4.50,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should return session with running total', async () => {
      mockDb.getSessionById.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/sessions/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.runningTotal).toBe(12.48); // (3.99*2) + (4.50*1) = 7.98 + 4.50 = 12.48
    });

    it('should return 404 for non-existent session', async () => {
      mockDb.getSessionById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sessions/550e8400-e29b-41d4-a716-446655440999')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await request(app)
        .get('/api/sessions/invalid-id')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // GET /sessions Tests
  // ============================================================================
  describe('GET /api/sessions - List Sessions', () => {
    it('should return list of user sessions', async () => {
      const mockSessions = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'test_user_123456',
          storeName: 'Whole Foods',
          startedAt: new Date().toISOString(),
          status: 'active',
          totalAmount: 45.99,
          itemCount: 3,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          userId: 'test_user_123456',
          storeName: 'Target',
          startedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed',
          totalAmount: 23.50,
          itemCount: 2,
        },
      ];

      mockDb.getUserSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockDb.getUserSessions).toHaveBeenCalledWith('test_user_123456', 100, 0);
    });
  });

  // ============================================================================
  // PATCH /sessions/:id Tests
  // ============================================================================
  describe('PATCH /api/sessions/:id - Update Session', () => {
    const existingSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'test_user_123456',
      storeName: 'Whole Foods',
      startedAt: new Date().toISOString(),
      status: 'active',
      totalAmount: 0,
      itemCount: 0,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSession = {
      ...existingSession,
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Bananas',
          quantity: 3,
          price: 1.99,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    it('should add items to session', async () => {
      mockDb.getSessionById
        .mockResolvedValueOnce(existingSession)
        .mockResolvedValueOnce(updatedSession);

      mockDb.addSessionItem.mockResolvedValue(updatedSession.items[0]);

      const response = await request(app)
        .patch('/api/sessions/550e8400-e29b-41d4-a716-446655440000')
        .send({
          items: [
            {
              name: 'Bananas',
              quantity: 3,
              price: 1.99,
            },
          ],
        })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.runningTotal).toBe(5.97); // 1.99 * 3
    });

    it('should return 404 for non-existent session', async () => {
      mockDb.getSessionById.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/sessions/550e8400-e29b-41d4-a716-446655440999')
        .send({ items: [{ name: 'Test' }] })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // POST /sessions/:id/capture Tests
  // ============================================================================
  describe('POST /api/sessions/:id/capture - Capture Receipt', () => {
    const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';

    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'test_user_123456',
      storeName: 'Whole Foods',
      startedAt: new Date().toISOString(),
      status: 'active',
      totalAmount: 45.99,
      itemCount: 3,
      items: [],
    };

    const mockReceipt: SessionReceipt = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      imageData: base64Image,
      mimeType: 'image/jpeg',
      notes: 'Receipt from aisle 3',
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    it('should capture receipt image', async () => {
      mockDb.getSessionById.mockResolvedValue(mockSession);
      mockDb.captureSessionReceipt.mockResolvedValue(mockReceipt);

      const response = await request(app)
        .post('/api/sessions/550e8400-e29b-41d4-a716-446655440000/capture')
        .send({
          imageData: base64Image,
          mimeType: 'image/jpeg',
          notes: 'Receipt from aisle 3',
        })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.mimeType).toBe('image/jpeg');
    });

    it('should return 400 for invalid MIME type', async () => {
      const response = await request(app)
        .post('/api/sessions/550e8400-e29b-41d4-a716-446655440000/capture')
        .send({
          imageData: base64Image,
          mimeType: 'image/gif',
        })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent session', async () => {
      mockDb.getSessionById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/sessions/550e8400-e29b-41d4-a716-446655440999/capture')
        .send({
          imageData: base64Image,
          mimeType: 'image/jpeg',
        })
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // GET /sessions/:id/receipts Tests
  // ============================================================================
  describe('GET /api/sessions/:id/receipts - List Receipts', () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'test_user_123456',
      storeName: 'Whole Foods',
      startedAt: new Date().toISOString(),
      status: 'active',
      totalAmount: 45.99,
      itemCount: 3,
      items: [],
    };

    const mockReceipts: SessionReceipt[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
        mimeType: 'image/jpeg',
        notes: 'Main receipt',
        capturedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAFo9MY/',
        mimeType: 'image/png',
        notes: 'Return receipt',
        capturedAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    it('should return list of receipts for session', async () => {
      mockDb.getSessionById.mockResolvedValue(mockSession);
      mockDb.getSessionReceipts.mockResolvedValue(mockReceipts);

      const response = await request(app)
        .get('/api/sessions/550e8400-e29b-41d4-a716-446655440000/receipts')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].mimeType).toBe('image/jpeg');
    });

    it('should return empty array for session with no receipts', async () => {
      mockDb.getSessionById.mockResolvedValue(mockSession);
      mockDb.getSessionReceipts.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/sessions/550e8400-e29b-41d4-a716-446655440000/receipts')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent session', async () => {
      mockDb.getSessionById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sessions/550e8400-e29b-41d4-a716-446655440999/receipts')
        .set('Authorization', 'Bearer test_token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
