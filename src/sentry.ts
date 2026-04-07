/**
 * Sentry Integration for Pantry-Pal API
 * 
 * Usage: Import and call initSentry() at the top of server.ts
 *        before any other imports
 * 
 * NOTE: This is optional. Sentry packages are not included by default.
 *       Install with: npm install @sentry/node @sentry/profiling-node
 */

// Declare Sentry as any to avoid import errors when not installed
declare const require: any;

let Sentry: any = null;
let nodeProfilingIntegration: any = null;

// Try to import Sentry (optional dependency)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const profiling = require('@sentry/profiling-node');
  nodeProfilingIntegration = profiling.nodeProfilingIntegration;
} catch (e) {
  // Sentry not installed, that's okay
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.log('[Sentry] DSN not configured, skipping Sentry initialization');
    return;
  }

  if (!Sentry) {
    console.log('[Sentry] Sentry packages not installed. Skipping initialization.');
    console.log('[Sentry] Install with: npm install @sentry/node @sentry/profiling-node');
    return;
  }
  
  Sentry.init({
    dsn: dsn,
    integrations: nodeProfilingIntegration ? [
      nodeProfilingIntegration(),
    ] : [],
    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    // Profiling
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    // Environment
    environment: process.env.NODE_ENV || 'development',
    // Release tracking (Railway provides git commit SHA)
    release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.npm_package_version || 'unknown',
    // Before sending, sanitize sensitive data
    beforeSend(event: any) {
      // Remove sensitive headers from request data
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-clerk-secret-key'];
        for (const header of sensitiveHeaders) {
          delete event.request.headers[header];
          delete event.request.headers[header.toLowerCase()];
        }
      }
      
      // Filter out common bot/error noise
      if (event.exception?.values?.some((ex: any) => 
        ex.value?.includes('favicon.ico') || 
        ex.value?.includes('robots.txt')
      )) {
        return null;
      }
      
      return event;
    },
  });
  
  console.log('[Sentry] Initialized for environment:', process.env.NODE_ENV);
}

export { Sentry };
