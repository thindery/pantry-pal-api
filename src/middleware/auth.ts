/**
 * Authentication middleware using Clerk
 * Verifies JWT tokens and extracts user ID from claims
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware to verify Clerk JWT token
 * Attaches userId to request object if valid
 * Returns 401 if no valid token
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    // Verify the JWT token using Clerk
    // issuer is automatically determined from the token
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
      issuer: process.env.CLERK_ISSUER_URL || '',
    } as any);

    // Extract userId from the token (Clerk uses 'sub' for user ID)
    const userId = payload.sub as string;

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

    // Attach userId to request
    req.userId = userId;
    next();
  } catch (error) {
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

/**
 * Optional auth middleware
 * Attaches userId if token is valid, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, but that's ok - continue without userId
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    // Verify the JWT token using Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
      issuer: process.env.CLERK_ISSUER_URL || '',
    } as any);

    // Extract userId from the token
    const userId = payload.sub as string;
    
    if (userId) {
      req.userId = userId;
    }
    
    next();
  } catch (error) {
    // Token invalid, but that's ok for optional auth
    next();
  }
}
