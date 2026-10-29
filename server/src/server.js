import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDBStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import copilotRoutes from './routes/copilotRoutes.js';
import discoverRoutes from './routes/discoverRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.execArgv.includes('--test') ||
  process.argv.some((arg) => arg.includes('test'));

// Connect to MongoDB when running as standalone server
if (!isTestEnv) {
  connectDB();
}

// Middleware
app.use(cors({
  origin: '*', // Allow client connections
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Meiora AI Backend',
    dbConnected: getDBStatus(),
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/discover', discoverRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

if (!isTestEnv) {
  app.listen(PORT, () => {
    console.log(`🚀 Meiora AI Server running on port ${PORT} [http://localhost:${PORT}]`);
    console.log(`📡 Health Check available at http://localhost:${PORT}/api/health`);
  });
}

export { app };
export default app;

