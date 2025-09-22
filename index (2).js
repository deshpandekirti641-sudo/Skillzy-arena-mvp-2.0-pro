/**
 * SKILLZY ARENA - API ROUTES SYSTEM
 * Comprehensive API routing for real-money gaming platform
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

// Import route handlers
const authRoutes = require('./auth');
const gameRoutes = require('./games');
const walletRoutes = require('./wallet');
const matchRoutes = require('./matches');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payments');
const analyticsRoutes = require('./analytics');
const kycRoutes = require('./kyc');
const referralRoutes = require('./referral');
const internationalRoutes = require('./international');
const withdrawalRoutes = require('./withdrawal');

// Rate limiting configurations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  message: { error: 'Too many requests', code: 'RATE_LIMIT_STRICT' }
});

const gamingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 gaming actions per minute
  message: { error: 'Gaming rate limit exceeded', code: 'GAMING_RATE_LIMIT' }
});

const walletLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 wallet operations per 5 minutes
  message: { error: 'Wallet operation limit exceeded', code: 'WALLET_RATE_LIMIT' }
});

// Middleware for request validation
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// Middleware for API versioning
const apiVersioning = (req, res, next) => {
  const version = req.headers['api-version'] || 'v1';
  req.apiVersion = version;
  next();
};

// Apply global middleware
router.use(apiVersioning);
router.use(express.json());

// Health and status routes
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      spacetimedb: 'connected',
      payments: 'operational',
      gaming: 'active'
    }
  });
});

router.get('/status', (req, res) => {
  res.json({
    platform: 'Skillzy Arena',
    mode: 'real-money-gaming',
    payoutSplit: '80/20',
    gamesActive: ['Chess', 'Snake & Ladder', 'Carrom'],
    languages: 10,
    currencies: 12,
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Gaming routes with rate limiting
router.use('/games', gamingLimiter, gameRoutes);
router.use('/matches', gamingLimiter, matchRoutes);

// Financial routes with strict rate limiting
router.use('/wallet', walletLimiter, walletRoutes);
router.use('/payments', walletLimiter, paymentRoutes);
router.use('/withdrawal', strictLimiter, withdrawalRoutes);

// Admin routes with highest security
router.use('/admin', strictLimiter, adminRoutes);

// User management routes
router.use('/analytics', analyticsRoutes);
router.use('/kyc', kycRoutes);
router.use('/referral', referralRoutes);

// International support routes
router.use('/international', internationalRoutes);

// Error handling for routes
router.use((error, req, res, next) => {
  console.error('Route error:', error);
  res.status(error.status || 500).json({
    error: 'API error occurred',
    code: error.code || 'API_ERROR',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;