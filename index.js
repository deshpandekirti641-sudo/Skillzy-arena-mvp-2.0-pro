/**
 * SKILLZY ARENA - PROFESSIONAL GAMING PLATFORM
 * Main Entry Point for Real-Money Gaming Application
 * 
 * Features:
 * - Multi-language support (10+ languages)
 * - Multi-currency support (12+ currencies) 
 * - Real-time gaming with SpacetimeDB
 * - 80/20 payout split (₹16 winner, ₹4 platform)
 * - Network-resilient architecture
 * - Professional UI matching MPL/WinZO standards
 */

const express = require('express');
const next = require('next');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const winston = require('winston');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Import core systems
const adminRoutes = require('./admin');
const matchSystem = require('./match');
const walletSystem = require('./wallet');
const config = require('./config');

// Environment configuration
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'skillzy-arena' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting for API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Gaming-specific rate limit for match operations
const gamingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 game actions per minute
  message: {
    error: 'Gaming rate limit exceeded. Please wait before next action.',
    code: 'GAMING_RATE_LIMIT'
  }
});

app.prepare().then(() => {
  const server = express();

  // Security middleware
  server.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"]
      }
    }
  }));

  // CORS configuration for international support
  server.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [config.ALLOWED_ORIGINS] 
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Compression for better performance
  server.use(compression());

  // Body parsing middleware
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  server.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next();
  });

  // Health check endpoint
  server.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: 'Skillzy Arena Gaming Platform',
      version: '1.0.0'
    });
  });

  // API rate limiting
  server.use('/api', limiter);
  server.use('/api/game', gamingLimiter);
  server.use('/api/match', gamingLimiter);
  server.use('/api/wallet', limiter);

  // Core system routes
  server.use('/api/admin', adminRoutes);
  server.use('/api/match', matchSystem.routes);
  server.use('/api/wallet', walletSystem.routes);

  // SpacetimeDB proxy for real-time gaming
  server.use('/spacetimedb', createProxyMiddleware({
    target: config.SPACETIMEDB_URL,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    pathRewrite: {
      '^/spacetimedb': ''
    },
    onError: (err, req, res) => {
      logger.error('SpacetimeDB proxy error:', err);
      res.status(500).json({
        error: 'Gaming service temporarily unavailable',
        code: 'SPACETIMEDB_ERROR'
      });
    }
  }));

  // Payment gateway proxy for international transactions
  server.use('/api/payments', createProxyMiddleware({
    target: config.PAYMENT_GATEWAY_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/payments': ''
    }
  }));

  // Flutter API endpoints for mobile integration
  server.use('/flutter-api', require('./flutter-backend'));

  // Error handling middleware
  server.use((error, req, res, next) => {
    logger.error('Server error:', error);
    
    res.status(error.status || 500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  });

  // Next.js handler (must be last)
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // Server startup
  server.listen(port, (err) => {
    if (err) {
      logger.error('Failed to start server:', err);
      throw err;
    }
    
    logger.info(`🎮 Skillzy Arena Gaming Platform running on port ${port}`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
    logger.info(`💎 Real-money gaming with 80/20 payout split active`);
    logger.info(`🚀 Multi-language & multi-currency support enabled`);
    logger.info(`🛡️ Security, rate limiting, and anti-fraud measures active`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

}).catch((ex) => {
  logger.error('Failed to start application:', ex);
  process.exit(1);
});

module.exports = app;