"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const items_1 = __importDefault(require("./routes/items"));
const activities_1 = __importDefault(require("./routes/activities"));
const scan_1 = __importDefault(require("./routes/scan"));
const envPath = path_1.default.resolve(process.cwd(), '.env');
dotenv_1.default.config({ path: envPath });
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : isDevelopment
        ? true
        : [];
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
app.get('/health', (_req, res) => {
    try {
        (0, db_1.getDatabase)();
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
        const server = app.listen(PORT, () => {
            console.log(`[SERVER] Pantry Tracker API running on http://localhost:${PORT}`);
            console.log(`[SERVER] Environment: ${NODE_ENV}`);
            console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
            console.log(`[SERVER] API docs: http://localhost:${PORT}/api`);
        });
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