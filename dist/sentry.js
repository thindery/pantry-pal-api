"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = void 0;
exports.initSentry = initSentry;
let Sentry = null;
exports.Sentry = Sentry;
let nodeProfilingIntegration = null;
try {
    exports.Sentry = Sentry = require('@sentry/node');
    const profiling = require('@sentry/profiling-node');
    nodeProfilingIntegration = profiling.nodeProfilingIntegration;
}
catch (e) {
}
function initSentry() {
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
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
        profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
        environment: process.env.NODE_ENV || 'development',
        release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.npm_package_version || 'unknown',
        beforeSend(event) {
            if (event.request?.headers) {
                const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-clerk-secret-key'];
                for (const header of sensitiveHeaders) {
                    delete event.request.headers[header];
                    delete event.request.headers[header.toLowerCase()];
                }
            }
            if (event.exception?.values?.some((ex) => ex.value?.includes('favicon.ico') ||
                ex.value?.includes('robots.txt'))) {
                return null;
            }
            return event;
        },
    });
    console.log('[Sentry] Initialized for environment:', process.env.NODE_ENV);
}
//# sourceMappingURL=sentry.js.map