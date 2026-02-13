"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const db_1 = require("./db");
const items_1 = __importDefault(require("./routes/items"));
const activities_1 = __importDefault(require("./routes/activities"));
const scan_1 = __importDefault(require("./routes/scan"));
const subscription_1 = __importDefault(require("./routes/subscription"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const barcode_1 = __importDefault(require("./routes/barcode"));
const errors_1 = __importDefault(require("./routes/errors"));
const stripe_1 = require("./services/stripe");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const USE_HTTPS = process.env.USE_HTTPS !== 'false';
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : isDevelopment
        ? [
            'https://localhost:5173',
            'https://192.168.86.48:5173',
            'https://127.0.0.1:5173',
            'https://frondescent-terri-boltlike.ngrok-free.dev',
        ]
        : [];
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path_1.default.resolve(__dirname, '../.certs/localhost+3.pem');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path_1.default.resolve(__dirname, '../.certs/localhost+3-key.pem');
const app = (0, express_1.default)();
exports.app = app;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: isDevelopment ? false : undefined,
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (isDevelopment) {
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}
app.get('/', (_req, res) => {
    res.json({
        name: 'Pantry Tracker API',
        version: '1.0.0',
        status: 'operational',
        environment: NODE_ENV,
        documentation: '/api',
        health: '/health',
    });
});
app.get('/health', async (_req, res) => {
    try {
        const db = (0, db_1.getDatabase)();
        await db.query('SELECT 1');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
            version: '1.0.0',
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Database connection failed',
        });
    }
});
app.get('/api', (_req, res) => {
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
app.use('/api/items', items_1.default);
app.use('/api/activities', activities_1.default);
app.use('/api/subscription', subscription_1.default);
app.use('/api/products/barcode', barcode_1.default);
app.use('/api/errors', errors_1.default);
app.use('/api/webhooks', webhook_1.default);
app.use('/api', scan_1.default);
app.use((_req, res) => {
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
app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err);
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
async function startServer() {
    try {
        console.log('[SERVER] Initializing database...');
        (0, db_1.getDatabase)();
        console.log('[SERVER] Database connected successfully');
        let server;
        let protocol = 'http';
        if (USE_HTTPS && fs_1.default.existsSync(SSL_CERT_PATH) && fs_1.default.existsSync(SSL_KEY_PATH)) {
            const sslOptions = {
                key: fs_1.default.readFileSync(SSL_KEY_PATH),
                cert: fs_1.default.readFileSync(SSL_CERT_PATH),
            };
            server = https_1.default.createServer(sslOptions, app);
            protocol = 'https';
            console.log('[SERVER] Using HTTPS with custom certificates');
        }
        else {
            console.log('[SERVER] HTTPS certificates not found, falling back to HTTP');
            console.log('[SERVER] For HTTPS, ensure certificates exist at:');
            console.log(`[SERVER]   Cert: ${SSL_CERT_PATH}`);
            console.log(`[SERVER]   Key:  ${SSL_KEY_PATH}`);
            const http = await Promise.resolve().then(() => __importStar(require('http')));
            server = http.createServer(app);
            protocol = 'http';
        }
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] Pantry Tracker API running on ${protocol}://localhost:${PORT}`);
            console.log(`[SERVER] Pantry Tracker API running on ${protocol}://192.168.86.48:${PORT}`);
            console.log(`[SERVER] Environment: ${NODE_ENV}`);
            console.log(`[SERVER] Health check: ${protocol}://localhost:${PORT}/health`);
            console.log(`[SERVER] API docs: ${protocol}://localhost:${PORT}/api`);
        });
        if (process.env.STRIPE_SECRET_KEY) {
            console.log('[SERVER] Initializing Stripe products...');
            (0, stripe_1.ensureStripeProducts)().then(() => {
                console.log('[SERVER] Stripe products initialized');
            }).catch((err) => {
                console.error('[SERVER] Failed to initialize Stripe products:', err);
            });
        }
        const gracefulShutdown = (signal) => {
            console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
            server.close(() => {
                console.log('[SERVER] HTTP server closed');
                (0, db_1.closeDatabase)();
                console.log('[SERVER] Database connection closed');
                process.exit(0);
            });
            setTimeout(() => {
                console.error('[SERVER] Forced shutdown due to timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            console.error('[SERVER] Uncaught exception:', error);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            console.error('[SERVER] Unhandled rejection:', reason);
        });
    }
    catch (error) {
        console.error('[SERVER] Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map