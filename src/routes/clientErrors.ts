import express from 'express';
import { getDatabase } from '../db';

const router = express.Router();

// POST /api/client-errors - Log error from frontend
router.post('/', async (req, res) => {
  try {
    const error = {
      userId: req.body.userId,
      errorType: req.body.type,
      errorMessage: req.body.message,
      errorStack: req.body.stack,
      component: req.body.component,
      url: req.body.url,
      userAgent: req.body.userAgent,
    };
    
    const saved = await getDatabase().saveClientError(error);
    res.json({ success: true, id: saved.id });
  } catch (err) {
    console.error('Failed to save client error:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// GET /api/client-errors - Get errors for admin
router.get('/', async (req, res) => {
  try {
    const { resolved = 'false', limit = '50' } = req.query;
    const errors = await getDatabase().getClientErrors({
      resolved: resolved === 'true',
      limit: parseInt(limit as string),
    });
    res.json({ errors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// PATCH /api/client-errors/:id/resolve - Mark resolved
router.patch('/:id/resolve', async (req, res) => {
  try {
    await getDatabase().markErrorResolved(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

export default router;
