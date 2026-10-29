import express from 'express';
import { getTrendingDiscoveries } from '../controllers/discoverController.js';

const router = express.Router();

router.get('/', getTrendingDiscoveries);
router.get('/trending', getTrendingDiscoveries);

export default router;
