const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

// Helper to accept CommonJS or ESM route exports
const asMiddleware = (mod) => {
  if (!mod) return mod;
  // If it's already an Express router or middleware function
  if (typeof mod === 'function' || (mod && typeof mod.use === 'function')) return mod;
  // If exported as { router }
  if (mod.router && (typeof mod.router === 'function' || (mod.router && typeof mod.router.use === 'function'))) return mod.router;
  // If exported as ESM default
  if (mod.default && (typeof mod.default === 'function' || (mod.default && typeof mod.default.use === 'function'))) return mod.default;
  return mod;
};

// Import route modules (normalized)
const authRoutes = asMiddleware(require('./routes/auth'));
const usersRoutes = asMiddleware(require('./routes/users'));
const projectsRoutes = asMiddleware(require('./routes/projects'));
const stakeholdersRoutes = asMiddleware(require('./routes/stakeholders'));
const roadmapRoutes = asMiddleware(require('./routes/roadmap'));
const backlogRoutes = asMiddleware(require('./routes/backlog'));
const accessRoutes = asMiddleware(require('./routes/access'));
const auditRoutes = asMiddleware(require('./routes/audit'));
const capacityRoutes = asMiddleware(require('./routes/capacity'));
const retroRoutes = asMiddleware(require('./routes/retro'));
const workspaceRoutes = asMiddleware(require('./routes/workspace'));
const wizardRoutes = asMiddleware(require('./routes/wizard'));
const departmentRoutes = asMiddleware(require('./routes/department'));
const budgetRoutes = asMiddleware(require('./routes/budget'));
const teamsRoutes = asMiddleware(require('./routes/teams'));
const analyticsRoutes = asMiddleware(require('./routes/analytics'));

const app = express();

// Initialize async context per request for auth.uid support
const { runWithContext } = require('./utils/requestContext');
app.use((req, res, next) => runWithContext({}, next));

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    try {
      const allowedEnv = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
      const isLocalhost = !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isAllowedEnv = !!origin && allowedEnv.includes(origin);
      let isLovableSandbox = false;
      try {
        if (origin) {
          const hostname = new URL(origin).hostname;
          isLovableSandbox = /lovable\.dev$/.test(hostname);
        }
      } catch {}

      if (!origin || isLocalhost || isAllowedEnv || isLovableSandbox) {
        return callback(null, true);
      }
    } catch {}
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
  optionsSuccessStatus: 204,
};

// Apply CORS before security middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 100 : 1000), // Much higher for dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
      return isLocalhost;
    }
    return false;
  }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
const { requestLogger } = require('./middleware/requestLogger');
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
  app.use(requestLogger);
} else {
  app.use(morgan('combined'));
  app.use(requestLogger);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV 
  });
});

// API routes
app.use('/auth-service', authRoutes);
app.use('/users', usersRoutes);
app.use('/projects-service', projectsRoutes);
app.use('/stakeholder-service', stakeholdersRoutes);
app.use('/roadmap-service', roadmapRoutes);
app.use('/backlog-service', backlogRoutes);
app.use('/access-service', accessRoutes);
app.use('/audit-service', auditRoutes);
app.use('/capacity-service', capacityRoutes);
app.use('/retro-service', retroRoutes);
app.use('/workspace-service', workspaceRoutes);
app.use('/wizard-service', wizardRoutes);
app.use('/department-service', departmentRoutes);
app.use('/budget-service', budgetRoutes);
app.use('/analytics-service', analyticsRoutes);
app.use('/', teamsRoutes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;