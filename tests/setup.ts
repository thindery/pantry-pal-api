/**
 * Test Setup
 * Configure test environment and mock external services
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.DB_PATH = ':memory:';
process.env.CLERK_SECRET_KEY = 'test_sk_key';
process.env.CLERK_ISSUER_URL = 'https://test.clerk.dev';
process.env.PORT = '3002';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for database operations
jest.setTimeout(10000);
