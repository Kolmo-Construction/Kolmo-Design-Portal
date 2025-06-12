import { Router } from 'express';
import { getClientDashboard } from '@server/controllers/client.controller';

const router = Router();

// GET /api/client/dashboard - Get client dashboard data
router.get('/dashboard', getClientDashboard);

export default router;