import express from 'express';

const router = express.Router();

interface ErrorLogRequest {
  type?: string;
  message?: string;
  component?: string;
  url?: string;
  userAgent?: string;
  stack?: string;
}

/**
 * POST /api/errors
 * Log client-side errors for admin dashboard viewing
 */
router.post('/', async (req: express.Request<{}, {}, ErrorLogRequest>, res: express.Response) => {
  const { type, message, component, url, userAgent, stack } = req.body;

  // Log to console for now
  console.error('[CLIENT ERROR]', {
    type,
    message,
    component,
    url,
    userAgent,
    stack: stack?.slice(0, 200),
    timestamp: new Date().toISOString(),
  });

  // Could save to DB for admin dashboard in the future
  // await getDatabase().saveClientError({...});

  res.json({ success: true });
});

export default router;
