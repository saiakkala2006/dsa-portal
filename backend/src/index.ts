import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { checkJudge0Health, runCode } from './services/judge0';

// Routes
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import questionRoutes from './routes/questions';
import examRoutes from './routes/exams';
import studentExamRoutes from './routes/studentExam';

const app = express();

// Trust proxy for Cloudflare Tunnel
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Auth route rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files for uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check
app.get('/api/health', async (_req, res) => {
  const judge0Healthy = await checkJudge0Health();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      judge0: judge0Healthy ? 'connected' : 'unavailable',
    },
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin/students', studentRoutes);
app.use('/api/admin/questions', questionRoutes);
app.use('/api/admin/exams', examRoutes);
app.use('/api/student', studentExamRoutes);

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    // Check Judge0
    const judge0Health = await checkJudge0Health();
    if (judge0Health) {
      console.log('✅ Judge0 connected');
    } else {
      console.log('⚠️  Judge0 not available - code execution will fail');
    }

    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
