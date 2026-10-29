import express from 'express';
import {
  analyzeNews,
  analyzeBrand,
  analyzeRumor,
  analyzeDeepfakeVideo,
  getHistory,
  getById,
  deleteById,
} from '../controllers/analysisController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { handleMediaUpload, handleVideoUpload } from '../middleware/upload.js';

const router = express.Router();

// Analysis generation endpoints (Guests can run ephemeral checks; logged in users persist to their account)
router.post('/news', optionalAuth, handleMediaUpload, analyzeNews);
router.post('/brand', optionalAuth, analyzeBrand);
router.post('/rumor', optionalAuth, handleMediaUpload, analyzeRumor);
router.post('/deepfake-video', optionalAuth, handleVideoUpload, analyzeDeepfakeVideo);

// Private User Record Management (Strictly protected by authentication & ownership)
router.get('/history', protect, getHistory);
router.get('/:id', protect, getById);
router.delete('/:id', protect, deleteById);

export default router;
