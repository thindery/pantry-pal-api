/**
 * Pantry Tracker API Server
 * Production-ready Express server with security, error handling, and graceful shutdown
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

// Import database initialization
import { getDatabase, closeDatabase } from './db';

// Import route handlers
import itemsRouter from './routes/items';
import activitiesRouter from './routes/activities';
import scanRouter from './routes/scan';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// CORS configuration
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : isDevelopment
  ? true // Allow all origins in development
  : []; // Restrict in production (should be configured)

// ============================================================================
// Express Application Setup
// ============================================================================

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : undefined,
  crossOriginEmbedderPolicy: false, // Allow for API usage
}));

// CORS middleware
app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development only)
if (isDevelopment) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================================
// Health Check & API Info
// ============================================================================

/**
 * Root endpoint - API information
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Pantry Tracker API',
    version: '1.0.0',
    status: 'operational',
    environment: NODE_ENV,
    documentation: '/api',
    health: '/health',
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  try {
    // Test database connection
    getDatabase();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

/**
 * API documentation/endpoint listing
 */
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'Pantry Tracker API',
    version: '1.0.0',
    description: 'Inventory management with receipt scanning and visual usage detection',
    endpoints: {
      items: {
        'GET /api/items': 'List all pantry items (optional: ?category=)',
        'GET /api/items/categories': 'Get all unique categories',
        'GET /api/items/:id': 'Get a specific item by ID',
        'POST /api/items': 'Create a new pantry item',
        'PUT /api/items/:id': 'Update an existing item',
        'DELETE /api/items/:id': 'Delete an item',
      },
      activities: {
        'GET /api/activities': 'List recent activities (supports pagination)',
        'POST /api/activities': 'Log a new activity (ADD, REMOVE, ADJUST)',
      },
      scan: {
        'POST /api/scan-receipt': 'Process receipt scan and return parsed items',
        'POST /api/scan-receipt/import': 'Scan and automatically import items',
        'POST /api/visual-usage': 'Process visual usage detection results',
        'GET /api/visual-usage/supported-items': 'Get list of detectable items',
      },
    },
    models: {
      PantryItem: {
        id: 'string (UUID)',
        name: 'string',
        quantity: 'number',
        unit: 'string',
        category: 'string',
        lastUpdated: 'string (ISO 8601)',
      },
      Activity: {
        id: 'string (UUID)',
        itemId: 'string (UUID)',
        itemName: 'string',
        type: "'ADD' | 'REMOVE' | 'ADJUST'",
        amount: 'number',
        timestamp: 'string (ISO 8601)',
        source: "'MANUAL' | 'RECEIPT_SCAN' | 'VISUAL_USAGE'",
      },
    },
  });
});

// ============================================================================
// API Routes
// ============================================================================

/**
 * Mount route handlers
 */
app.use('/api/items', itemsRouter);
app.use('/api/activities', activitiesRouter);
// Scan routes are mounted at root for cleaner URLs per spec
app.use('/api', scanRouter);

// ============================================================================
// Error Handling
// ============================================================================

/**
 * 404 Not Found handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Global error handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);

  // Don't leak error details in production
  const message = isDevelopment
    ? err.message
    : 'An internal error occurred';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(isDevelopment && { stack: err.stack }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Initialize database and start server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    console.log('[SERVER] Initializing database...');
    getDatabase();
    console.log('[SERVER] Database connected successfully');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] Pantry Tracker API running on http://localhost:${PORT}`);
      console.log(`[SERVER] Environment: ${NODE_ENV}`);
      console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
      console.log(`[SERVER] API docs: http://localhost:${PORT}/api`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('[SERVER] HTTP server closed');
        
        closeDatabase();
        console.log('[SERVER] Database connection closed');
        
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('[SERVER] Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled error handlers
    process.on('uncaughtException', (error) => {
      console.error('[SERVER] Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[SERVER] Unhandled rejection:', reason);
    });

  } catch (error) {
    console.error('[SERVER] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing
export { app };