import express from 'express';
import { ask } from '../controllers/copilotController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/ask', optionalAuth, ask);

export default router;
