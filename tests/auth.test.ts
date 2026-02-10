/**
 * Authentication Middleware Tests
 * Clerk auth middleware tests with mock token validation
 * Priority: P0 - Token validation, mock auth
 */

import { requireAuth, optionalAuth } from '../src/middleware/auth';
import { Request, Response, NextFunction } from 'express';

// Mock Clerk SDK
jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: jest.fn(),
}));

import { verifyToken } from '@clerk/clerk-sdk-node';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockReq = {
      headers: {},
    };
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
  });

  // ============================================================================
  // requireAuth Tests (P0)
  // ============================================================================
  describe('requireAuth', () => {
    it('should call next() with valid token', async () => {
      const mockUserId = 'user_123456789';
      (verifyToken as jest.Mock).mockResolvedValue({
        sub: mockUserId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: 'Bearer valid_token',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(verifyToken).toHaveBeenCalledWith('valid_token', expect.any(Object));
      expect(mockReq.userId).toBe(mockUserId);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header', async () => {
      mockReq.headers = {};

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockReq.headers = {
        authorization: 'Basic dXNlcjpwYXNz',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is missing', async () => {
      mockReq.headers = {
        authorization: 'Bearer ',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'No token provided.',
          }),
        })
      );
    });

    it('should return 401 when token verification fails', async () => {
      (verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      mockReq.headers = {
        authorization: 'Bearer invalid_token',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token. Please sign in again.',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token has no user ID', async () => {
      (verifyToken as jest.Mock).mockResolvedValue({
        sub: null,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: 'Bearer token_no_user',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
            message: 'Invalid token: no user ID found.',
          }),
        })
      );
    });

    it('should return 401 when token is expired', async () => {
      (verifyToken as jest.Mock).mockRejectedValue(new Error('Token expired'));

      mockReq.headers = {
        authorization: 'Bearer expired_token',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should include timestamp in error response', async () => {
      mockReq.headers = {};

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.meta.timestamp).toBeDefined();
      expect(new Date(response.meta.timestamp).getTime()).not.toBeNaN();
    });

    it('should verify token with correct secret key', async () => {
      process.env.CLERK_SECRET_KEY = 'sk_test_custom';
      process.env.CLERK_ISSUER_URL = 'https://test.clerk.dev';

      (verifyToken as jest.Mock).mockResolvedValue({
        sub: 'user_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: 'Bearer test_token',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(verifyToken).toHaveBeenCalledWith(
        'test_token',
        expect.objectContaining({
          secretKey: 'sk_test_custom',
          issuer: 'https://test.clerk.dev',
        })
      );
    });
  });

  // ============================================================================
  // optionalAuth Tests
  // ============================================================================
  describe('optionalAuth', () => {
    it('should attach userId when valid token provided', async () => {
      const mockUserId = 'user_optional_123';
      (verifyToken as jest.Mock).mockResolvedValue({
        sub: mockUserId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: 'Bearer valid_token',
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.userId).toBe(mockUserId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without userId when no authorization header', async () => {
      mockReq.headers = {};

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should continue without userId when token is invalid', async () => {
      (verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      mockReq.headers = {
        authorization: 'Bearer invalid_token',
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should continue without userId when token has no sub', async () => {
      (verifyToken as jest.Mock).mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: 'Bearer no_sub_token',
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle authorization header without Bearer prefix', async () => {
      mockReq.headers = {
        authorization: 'Basic dXNlcjpwYXNz',
      };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle malformed authorization header', async () => {
      mockReq.headers = {
        authorization: 'Bearer',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle token with only whitespace', async () => {
      mockReq.headers = {
        authorization: 'Bearer   ',
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle multiple spaces in authorization header', async () => {
      mockReq.headers = {
        authorization: 'Bearer    token_with_spaces   ',
      };

      // The middleware splits by single space, so this results in empty string as token
      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should return 401 since split(' ')[1] returns empty string with multiple spaces
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000);
      
      (verifyToken as jest.Mock).mockRejectedValue(new Error('Token too long'));

      mockReq.headers = {
        authorization: `Bearer ${longToken}`,
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle special characters in token', async () => {
      const specialToken = 'token+with/special=chars_test.123';
      
      (verifyToken as jest.Mock).mockResolvedValue({
        sub: 'user_special',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockReq.headers = {
        authorization: `Bearer ${specialToken}`,
      };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(verifyToken).toHaveBeenCalledWith(specialToken, expect.any(Object));
      expect(mockReq.userId).toBe('user_special');
    });
  });
});
