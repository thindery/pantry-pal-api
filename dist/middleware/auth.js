"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required. Please sign in.',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'No token provided.',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
        const payload = await (0, clerk_sdk_node_1.verifyToken)(token, {
            secretKey: process.env.CLERK_SECRET_KEY || '',
            issuer: process.env.CLERK_ISSUER_URL || '',
        });
        const userId = payload.sub;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid token: no user ID found.',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
        req.userId = userId;
        next();
    }
    catch (error) {
        console.error('[Auth Middleware] Token verification failed:', error);
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token. Please sign in again.',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
}
async function optionalAuth(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            next();
            return;
        }
        const payload = await (0, clerk_sdk_node_1.verifyToken)(token, {
            secretKey: process.env.CLERK_SECRET_KEY || '',
            issuer: process.env.CLERK_ISSUER_URL || '',
        });
        const userId = payload.sub;
        if (userId) {
            req.userId = userId;
        }
        next();
    }
    catch (error) {
        next();
    }
}
//# sourceMappingURL=auth.js.map