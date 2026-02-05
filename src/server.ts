/**
 * Pantry Tracker API Server
 * Production-ready Express server with HTTPS support for local development,
 * security, error handling, and graceful shutdown
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Import database initialization
import { getDatabase, closeDatabase } from './db';

// Import route handlers
import itemsRouter from './routes/items';
import activitiesRouter from './routes/activities';
import scanRouter from './routes/scan';
import subscriptionRouter from './routes/subscription';
import webhookRouter from './routes/webhook';

// Import services
import { ensureStripeProducts } from './services/stripe';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const USE_HTTPS = process.env.USE_HTTPS !== 'false'; // Default to HTTPS

// CORS configuration - allow both localhost and the local IP
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : isDevelopment
  ? [
      'https://localhost:5173',
      'https://192.168.86.48:5173',
      'https://127.0.0.1:5173',
    ]
  : []; // Restrict in production (should be configured)

// SSL Certificate paths
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.resolve(__dirname, '../.certs/localhost+3.pem');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.resolve(__dirname, '../.certs/localhost+3-key.pem');

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
      subscription: {
        'GET /api/subscription/tier': 'Get current tier info and usage limits',
        'GET /api/subscription/check-items': 'Check item limit status',
        'GET /api/subscription/check-receipt': 'Check receipt scan limit status',
        'GET /api/subscription/check-voice': 'Check voice assistant access',
        'GET /api/subscription/prices': 'Get Stripe price IDs',
        'POST /api/subscription/checkout': 'Create checkout session for upgrade',
        'POST /api/subscription/portal': 'Create customer portal session',
        'GET /api/subscription/status': 'Get subscription status',
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
app.use('/api/subscription', subscriptionRouter);
// Webhook route needs raw body for Stripe signature verification
app.use('/api/webhooks', webhookRouter);
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

    // Determine protocol and SSL options
    let server: https.Server | any;
    let protocol = 'http';
    
    if (USE_HTTPS && fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
      // Create HTTPS server
      const sslOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH),
      };
      
      server = https.createServer(sslOptions, app);
      protocol = 'https';
      console.log('[SERVER] Using HTTPS with custom certificates');
    } else {
      // Fallback to HTTP if no certificates available
      console.log('[SERVER] HTTPS certificates not found, falling back to HTTP');
      console.log('[SERVER] For HTTPS, ensure certificates exist at:');
      console.log(`[SERVER]   Cert: ${SSL_CERT_PATH}`);
      console.log(`[SERVER]   Key:  ${SSL_KEY_PATH}`);
      // Create HTTP server using http module
      const http = await import('http');
      server = http.createServer(app);
      protocol = 'http';
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Pantry Tracker API running on ${protocol}://localhost:${PORT}`);
      console.log(`[SERVER] Pantry Tracker API running on ${protocol}://192.168.86.48:${PORT}`);
      console.log(`[SERVER] Environment: ${NODE_ENV}`);
      console.log(`[SERVER] Health check: ${protocol}://localhost:${PORT}/health`);
      console.log(`[SERVER] API docs: ${protocol}://localhost:${PORT}/api`);

    });

    // Initialize Stripe products if configured (outside listen callback)
    if (process.env.STRIPE_SECRET_KEY) {
      console.log('[SERVER] Initializing Stripe products...');
      ensureStripeProducts().then(() => {
        console.log('[SERVER] Stripe products initialized');
      }).catch((err) => {
        console.error('[SERVER] Failed to initialize Stripe products:', err);
      });
    }

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
