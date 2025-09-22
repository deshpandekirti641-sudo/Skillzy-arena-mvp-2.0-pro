/**
 * SKILLZY ARENA - ADMIN SYSTEM
 * Comprehensive admin panel for gaming platform management
 * 
 * Features:
 * - Developer wallet management
 * - Platform earnings tracking  
 * - User management and analytics
 * - Game settings and controls
 * - Security monitoring and KYC
 * - International payment oversight
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');

const router = express.Router();

// Admin rate limiting - very strict
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Only 20 requests per 15 minutes
  message: { error: 'Admin rate limit exceeded', code: 'ADMIN_RATE_LIMIT' }
});

// Logger for admin actions
const adminLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/admin.log' }),
    new winston.transports.Console()
  ]
});

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Admin token required', code: 'ADMIN_TOKEN_MISSING' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'skillzy_admin_secret_2024');
    
    // Verify admin privileges
    if (decoded.role !== 'admin' || decoded.adminId !== 'dev_skillzy_owner_2024') {
      return res.status(403).json({ error: 'Admin access denied', code: 'ADMIN_ACCESS_DENIED' });
    }

    req.admin = decoded;
    adminLogger.info('Admin access granted', { adminId: decoded.adminId, action: req.method + ' ' + req.path });
    next();
  } catch (error) {
    adminLogger.error('Admin authentication failed', { error: error.message });
    return res.status(403).json({ error: 'Invalid admin token', code: 'ADMIN_TOKEN_INVALID' });
  }
};

// Apply rate limiting and authentication to all admin routes
router.use(adminLimiter);

// Admin login endpoint
router.post('/login', [
  body('adminId').isLength({ min: 5 }).withMessage('Admin ID required'),
  body('masterCode').isLength({ min: 8 }).withMessage('Master code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { adminId, masterCode } = req.body;

    // Verify admin credentials
    const validAdminIds = ['dev_skillzy_owner_2024', 'SKILLZY_ADMIN', 'ARENA_OWNER'];
    const validMasterCodes = ['SKILLZY2024DEV', 'ARENA_OWNER_ACCESS', 'MASTER_DEV_KEY'];

    if (!validAdminIds.includes(adminId) || !validMasterCodes.includes(masterCode)) {
      adminLogger.warn('Failed admin login attempt', { adminId, ip: req.ip });
      return res.status(401).json({ error: 'Invalid admin credentials', code: 'ADMIN_INVALID_CREDS' });
    }

    // Generate admin JWT
    const token = jwt.sign(
      { adminId, role: 'admin', timestamp: Date.now() },
      process.env.ADMIN_JWT_SECRET || 'skillzy_admin_secret_2024',
      { expiresIn: '4h' }
    );

    adminLogger.info('Admin login successful', { adminId, ip: req.ip });

    res.json({
      success: true,
      token,
      adminId,
      expiresIn: '4 hours',
      permissions: ['wallet_access', 'user_management', 'game_control', 'earnings_view', 'withdrawal_approval']
    });

  } catch (error) {
    adminLogger.error('Admin login error', { error: error.message });
    res.status(500).json({ error: 'Admin login failed', code: 'ADMIN_LOGIN_ERROR' });
  }
});

// All routes below require admin authentication
router.use(authenticateAdmin);

// Developer wallet management
router.get('/wallet', async (req, res) => {
  try {
    // Mock developer wallet data - integrate with SpacetimeDB
    const walletData = {
      balance: 45280, // ₹45,280 from platform fees
      currency: 'INR',
      totalEarnings: 125840, // Total lifetime earnings
      matchesProcessed: 11460, // Total matches processed
      averagePerMatch: 4, // ₹4 per match (20% of ₹20 pot)
      pendingWithdrawals: 0,
      lastWithdrawal: '2024-01-15T10:30:00Z',
      withdrawalHistory: [
        { id: 'wd_001', amount: 50000, date: '2024-01-15', status: 'completed' },
        { id: 'wd_002', amount: 30000, date: '2024-01-10', status: 'completed' }
      ]
    };

    adminLogger.info('Admin wallet access', { adminId: req.admin.adminId });
    res.json({ success: true, wallet: walletData });

  } catch (error) {
    adminLogger.error('Admin wallet error', { error: error.message });
    res.status(500).json({ error: 'Wallet data error', code: 'ADMIN_WALLET_ERROR' });
  }
});

// Initiate developer withdrawal
router.post('/wallet/withdraw', [
  body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal ₹100'),
  body('bankAccount').isLength({ min: 10 }).withMessage('Bank account required'),
  body('ifscCode').isLength({ min: 11, max: 11 }).withMessage('Valid IFSC code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { amount, bankAccount, ifscCode } = req.body;

    // Process withdrawal - integrate with payment gateway
    const withdrawalId = 'wd_' + Date.now();
    
    adminLogger.info('Admin withdrawal initiated', { 
      adminId: req.admin.adminId, 
      amount, 
      withdrawalId 
    });

    // Mock withdrawal processing
    setTimeout(() => {
      adminLogger.info('Withdrawal processed', { withdrawalId, amount });
    }, 5000);

    res.json({
      success: true,
      withdrawalId,
      amount,
      currency: 'INR',
      estimatedTime: '2-4 hours',
      status: 'processing'
    });

  } catch (error) {
    adminLogger.error('Admin withdrawal error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal failed', code: 'ADMIN_WITHDRAWAL_ERROR' });
  }
});

// Platform analytics and statistics
router.get('/analytics', async (req, res) => {
  try {
    const analytics = {
      overview: {
        totalUsers: 15847,
        activeUsers: 3254,
        totalMatches: 11460,
        totalRevenue: 229200, // ₹2,29,200 total pot value
        platformEarnings: 45840, // ₹45,840 (20% platform fee)
        payoutToWinners: 183360 // ₹1,83,360 (80% to winners)
      },
      games: {
        chess: { matches: 4820, revenue: 19280 },
        snakeLadder: { matches: 3910, revenue: 15640 },
        carrom: { matches: 2730, revenue: 10920 }
      },
      geography: {
        india: { users: 12678, revenue: 35072 },
        international: { users: 3169, revenue: 10768 }
      },
      currencies: {
        INR: { users: 12678, volume: 201840 },
        USD: { users: 2134, volume: 18920 },
        EUR: { users: 1035, volume: 8440 }
      },
      recentActivity: [
        { type: 'match_completed', game: 'chess', winner: 'user_1234', amount: 16 },
        { type: 'new_user', userId: 'user_5678', country: 'IN' },
        { type: 'withdrawal', userId: 'user_9012', amount: 500, status: 'completed' }
      ]
    };

    adminLogger.info('Admin analytics access', { adminId: req.admin.adminId });
    res.json({ success: true, analytics });

  } catch (error) {
    adminLogger.error('Admin analytics error', { error: error.message });
    res.status(500).json({ error: 'Analytics error', code: 'ADMIN_ANALYTICS_ERROR' });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    
    // Mock user data - integrate with database
    const users = [
      {
        id: 'user_1234',
        username: 'GamerPro',
        mobile: '+91XXXXXXXXX',
        walletBalance: 250,
        totalMatches: 45,
        winRate: 62,
        status: 'active',
        joinDate: '2024-01-10',
        kycStatus: 'verified'
      },
      {
        id: 'user_5678', 
        username: 'ChessMaster',
        mobile: '+91XXXXXXXXX',
        walletBalance: 180,
        totalMatches: 38,
        winRate: 71,
        status: 'active',
        joinDate: '2024-01-12',
        kycStatus: 'pending'
      }
    ];

    adminLogger.info('Admin user management access', { adminId: req.admin.adminId });
    res.json({ success: true, users, total: users.length });

  } catch (error) {
    adminLogger.error('Admin user management error', { error: error.message });
    res.status(500).json({ error: 'User management error', code: 'ADMIN_USER_ERROR' });
  }
});

// Game controls and settings
router.get('/games/settings', async (req, res) => {
  try {
    const gameSettings = {
      globalSettings: {
        betAmount: 10,
        payoutSplit: { winner: 80, platform: 20 },
        matchDuration: 60,
        maxConcurrentMatches: 1000
      },
      chess: {
        enabled: true,
        timeControl: '60+0',
        difficulty: 'adaptive'
      },
      snakeLadder: {
        enabled: true,
        boardSize: '10x10',
        diceType: 'standard'
      },
      carrom: {
        enabled: true,
        boardType: 'professional',
        physics: 'realistic'
      }
    };

    res.json({ success: true, settings: gameSettings });

  } catch (error) {
    adminLogger.error('Admin game settings error', { error: error.message });
    res.status(500).json({ error: 'Game settings error', code: 'ADMIN_GAME_ERROR' });
  }
});

// Update game settings
router.put('/games/settings', [
  body('betAmount').optional().isFloat({ min: 1 }),
  body('payoutSplit.winner').optional().isFloat({ min: 60, max: 90 }),
  body('payoutSplit.platform').optional().isFloat({ min: 10, max: 40 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    adminLogger.info('Admin game settings update', { 
      adminId: req.admin.adminId, 
      updates: req.body 
    });

    res.json({ success: true, message: 'Game settings updated' });

  } catch (error) {
    adminLogger.error('Admin game settings update error', { error: error.message });
    res.status(500).json({ error: 'Settings update failed', code: 'ADMIN_SETTINGS_ERROR' });
  }
});

// Security monitoring
router.get('/security', async (req, res) => {
  try {
    const securityData = {
      alerts: [
        { type: 'suspicious_activity', userId: 'user_xyz', details: 'Multiple failed login attempts', severity: 'high' },
        { type: 'unusual_pattern', userId: 'user_abc', details: 'Rapid successive wins', severity: 'medium' }
      ],
      kycPending: 23,
      fraudPrevention: {
        rulesActive: 15,
        blockedAttempts: 127,
        successfulBlocks: 119
      }
    };

    res.json({ success: true, security: securityData });

  } catch (error) {
    adminLogger.error('Admin security error', { error: error.message });
    res.status(500).json({ error: 'Security data error', code: 'ADMIN_SECURITY_ERROR' });
  }
});

// System logs
router.get('/logs', async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;
    
    // Mock log data - integrate with actual log system
    const logs = [
      { timestamp: '2024-01-20T10:30:00Z', level: 'info', message: 'Match completed successfully', data: { matchId: 'm_123' } },
      { timestamp: '2024-01-20T10:29:45Z', level: 'warn', message: 'High wallet activity detected', data: { userId: 'user_456' } }
    ];

    res.json({ success: true, logs });

  } catch (error) {
    adminLogger.error('Admin logs error', { error: error.message });
    res.status(500).json({ error: 'Logs error', code: 'ADMIN_LOGS_ERROR' });
  }
});

module.exports = router;