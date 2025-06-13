import { Router } from 'express';
import { getClientDashboard, getClientInvoices, getClientChatToken } from '@server/controllers/client.controller';

const router = Router();

// GET /api/client/dashboard - Get client dashboard data
// Authentication is handled at the router mount level in routes.ts
router.get('/dashboard', getClientDashboard);

// GET /api/client/invoices - Get client invoices
// Authentication is handled at the router mount level in routes.ts
router.get('/invoices', (req, res, next) => {
  // Disable caching for debugging
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, getClientInvoices);

// GET /api/client/chat-token - Get Stream Chat token for client
router.get('/chat-token', getClientChatToken);

export default router;