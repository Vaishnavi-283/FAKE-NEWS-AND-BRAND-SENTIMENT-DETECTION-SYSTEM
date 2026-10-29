import express from 'express';
import { getReports, downloadReport } from '../controllers/reportsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Private Reports Management (Authentication required to view or download user reports)
router.get('/', protect, getReports);
router.get('/:id/download', protect, downloadReport);

export default router;
