/**
 * SKILLZY ARENA - FLUTTER BACKEND INTEGRATION
 * Complete Flutter mobile app backend API
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const winston = require('winston');

const router = express.Router();

// Flutter backend logger
const flutterLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/flutter-backend.log' }),
    new winston.transports.Console()
  ]
});

// Flutter-specific rate limiting
const flutterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes for mobile app
  message: { error: 'Flutter API rate limit exceeded', code: 'FLUTTER_RATE_LIMIT' }
});

// CORS configuration for Flutter mobile app
const flutterCors = cors({
  origin: ['http://localhost:3001', 'https://skillzyarena.com', '*'], // Allow Flutter development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-App-Version']
});

// Apply middleware
router.use(flutterCors);
router.use(flutterLimiter);
router.use(express.json());

// Device tracking middleware
router.use((req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  const appVersion = req.headers['x-app-version'];
  
  req.deviceInfo = {
    deviceId,
    appVersion: appVersion || '1.0.0',
    platform: 'flutter',
    timestamp: Date.now()
  };
  
  flutterLogger.info('Flutter API request', {
    endpoint: req.path,
    deviceId,
    appVersion: req.deviceInfo.appVersion
  });
  
  next();
});

// Flutter app configuration endpoint
router.get('/config', async (req, res) => {
  try {
    const config = {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      supportedLanguages: [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'zh', name: '中文', flag: '🇨🇳' },
        { code: 'ar', name: 'العربية', flag: '🇸🇦' },
        { code: 'pt', name: 'Português', flag: '🇧🇷' },
        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' },
        { code: 'ko', name: '한국어', flag: '🇰🇷' }
      ],
      supportedCurrencies: [
        { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'GBP', symbol: '£', name: 'British Pound' },
        { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
        { code: 'KRW', symbol: '₩', name: 'Korean Won' },
        { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
        { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
        { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
        { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }
      ],
      games: [
        {
          id: 'chess',
          name: 'Chess Master',
          description: 'Strategic skill-based chess battles',
          icon: 'chess_icon',
          color: '#4CAF50',
          betAmount: 10,
          estimatedDuration: 60,
          skillRequired: 'high'
        },
        {
          id: 'snakeLadder',
          name: 'Snake & Ladder',
          description: 'Classic board game with strategy',
          icon: 'snake_ladder_icon',
          color: '#2196F3',
          betAmount: 10,
          estimatedDuration: 60,
          skillRequired: 'medium'
        },
        {
          id: 'carrom',
          name: 'Carrom Board',
          description: 'Precision-based skill game',
          icon: 'carrom_icon',
          color: '#FF9800',
          betAmount: 10,
          estimatedDuration: 60,
          skillRequired: 'high'
        }
      ],
      paymentMethods: {
        INR: ['UPI', 'Cards', 'NetBanking', 'Wallets'],
        USD: ['Cards', 'PayPal', 'Apple Pay'],
        EUR: ['Cards', 'SEPA', 'PayPal'],
        GBP: ['Cards', 'PayPal', 'Bank Transfer'],
        CNY: ['Alipay', 'WeChat Pay', 'UnionPay'],
        JPY: ['Cards', 'PayPal', 'Konbini'],
        KRW: ['Cards', 'KakaoPay', 'NaverPay'],
        BRL: ['PIX', 'Cards', 'Boleto'],
        RUB: ['Cards', 'Yandex.Money', 'Qiwi'],
        AED: ['Cards', 'PayPal', 'Bank Transfer'],
        SAR: ['Cards', 'STC Pay', 'Bank Transfer'],
        CAD: ['Cards', 'PayPal', 'Interac'],
        AUD: ['Cards', 'PayPal', 'POLi']
      },
      features: {
        kycRequired: true,
        referralProgram: true,
        multiLanguage: true,
        multiCurrency: true,
        realTimeMatching: true,
        securePayments: true
      },
      limits: {
        minWithdrawal: { INR: 100, USD: 5, EUR: 5 },
        maxWithdrawal: { INR: 200000, USD: 2500, EUR: 2200 },
        dailyMatchLimit: 50,
        maxConcurrentMatches: 3
      },
      platformInfo: {
        name: 'Skillzy Arena',
        version: '1.0.0',
        payoutSplit: { winner: 80, platform: 20 },
        supportEmail: 'support@skillzyarena.com'
      }
    };

    res.json({ success: true, config });

  } catch (error) {
    flutterLogger.error('Flutter config error', { error: error.message });
    res.status(500).json({ error: 'Configuration loading failed', code: 'CONFIG_ERROR' });
  }
});

// Flutter authentication
router.post('/auth/mobile-login', [
  body('mobile').isMobilePhone().withMessage('Valid mobile number required'),
  body('deviceId').isLength({ min: 1 }).withMessage('Device ID required'),
  body('language').optional().isIn(['en', 'hi', 'es', 'fr', 'de', 'zh', 'ar', 'pt', 'ru', 'ja', 'ko']).withMessage('Valid language required'),
  body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP', 'CNY', 'JPY', 'KRW', 'BRL', 'RUB', 'AED', 'SAR', 'CAD', 'AUD']).withMessage('Valid currency required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { mobile, deviceId, language = 'en', currency = 'INR' } = req.body;

    // Generate OTP (mock implementation)
    const otp = process.env.NODE_ENV === 'production' ? 
      Math.floor(100000 + Math.random() * 900000).toString() : 
      '123456';

    // Store OTP temporarily (use Redis in production)
    const otpData = {
      mobile,
      otp,
      deviceId,
      language,
      currency,
      timestamp: Date.now(),
      attempts: 0
    };

    // Mock OTP storage
    global.flutterOtpStore = global.flutterOtpStore || new Map();
    global.flutterOtpStore.set(mobile, otpData);

    // Send OTP via SMS (mock implementation)
    flutterLogger.info('OTP sent for Flutter app', { mobile, deviceId, otp });

    res.json({
      success: true,
      message: 'OTP sent successfully',
      otpSent: true,
      expiresIn: 300, // 5 minutes
      // In development, show OTP for testing
      ...(process.env.NODE_ENV !== 'production' && { testOtp: otp })
    });

  } catch (error) {
    flutterLogger.error('Flutter mobile login error', { error: error.message });
    res.status(500).json({ error: 'Mobile login failed', code: 'MOBILE_LOGIN_ERROR' });
  }
});

// Flutter OTP verification
router.post('/auth/verify-mobile', [
  body('mobile').isMobilePhone().withMessage('Valid mobile number required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP required'),
  body('deviceId').isLength({ min: 1 }).withMessage('Device ID required'),
  body('username').optional().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { mobile, otp, deviceId, username } = req.body;

    // Verify OTP
    const storedOtpData = global.flutterOtpStore?.get(mobile);
    
    if (!storedOtpData) {
      return res.status(400).json({ 
        error: 'OTP not found or expired', 
        code: 'OTP_NOT_FOUND' 
      });
    }

    if (storedOtpData.deviceId !== deviceId) {
      return res.status(400).json({ 
        error: 'Device mismatch', 
        code: 'DEVICE_MISMATCH' 
      });
    }

    if (storedOtpData.otp !== otp) {
      storedOtpData.attempts += 1;
      if (storedOtpData.attempts >= 3) {
        global.flutterOtpStore.delete(mobile);
        return res.status(400).json({ 
          error: 'Too many incorrect attempts', 
          code: 'OTP_ATTEMPTS_EXCEEDED' 
        });
      }
      return res.status(400).json({ 
        error: 'Invalid OTP', 
        code: 'INVALID_OTP',
        attemptsRemaining: 3 - storedOtpData.attempts
      });
    }

    // Check if OTP is expired (5 minutes)
    if (Date.now() - storedOtpData.timestamp > 5 * 60 * 1000) {
      global.flutterOtpStore.delete(mobile);
      return res.status(400).json({ 
        error: 'OTP expired', 
        code: 'OTP_EXPIRED' 
      });
    }

    // Create or get user
    const userId = 'flutter_user_' + mobile.replace(/\D/g, '');
    const userProfile = {
      userId,
      mobile,
      username: username || `Player${mobile.slice(-4)}`,
      language: storedOtpData.language,
      currency: storedOtpData.currency,
      deviceId,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      platform: 'flutter',
      walletBalance: 10, // Welcome bonus
      kycStatus: 'pending',
      isActive: true
    };

    // Generate JWT token for Flutter app
    const token = jwt.sign(
      { 
        userId, 
        mobile, 
        deviceId,
        platform: 'flutter',
        language: storedOtpData.language,
        currency: storedOtpData.currency
      },
      process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024',
      { expiresIn: '30d' } // 30 days for mobile app
    );

    // Clean up OTP
    global.flutterOtpStore.delete(mobile);

    flutterLogger.info('Flutter user authenticated', { 
      userId, 
      mobile, 
      deviceId,
      username: userProfile.username 
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        userId,
        username: userProfile.username,
        mobile,
        language: userProfile.language,
        currency: userProfile.currency,
        walletBalance: userProfile.walletBalance,
        kycStatus: userProfile.kycStatus,
        welcomeBonus: 10
      },
      token,
      expiresIn: '30 days'
    });

  } catch (error) {
    flutterLogger.error('Flutter OTP verification error', { error: error.message });
    res.status(500).json({ error: 'OTP verification failed', code: 'OTP_VERIFY_ERROR' });
  }
});

// Flutter user profile
router.get('/user/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024');

    // Mock user profile (integrate with database)
    const userProfile = {
      userId: decoded.userId,
      username: `Player${decoded.mobile?.slice(-4) || '0000'}`,
      mobile: decoded.mobile,
      language: decoded.language || 'en',
      currency: decoded.currency || 'INR',
      walletBalance: 250.75,
      totalMatches: 42,
      wins: 28,
      losses: 14,
      winRate: 66.7,
      totalWinnings: 448.0,
      kycStatus: 'pending',
      joinDate: '2024-01-15T10:30:00Z',
      lastLogin: Date.now(),
      isActive: true,
      achievements: [
        { id: 'first_win', name: 'First Victory', earned: true },
        { id: 'chess_master', name: 'Chess Master', earned: false },
        { id: 'winning_streak', name: '5 Win Streak', earned: true }
      ],
      preferences: {
        notifications: true,
        soundEffects: true,
        hapticFeedback: true,
        autoMatch: false
      }
    };

    res.json({ success: true, profile: userProfile });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    flutterLogger.error('Flutter profile error', { error: error.message });
    res.status(500).json({ error: 'Profile loading failed', code: 'PROFILE_ERROR' });
  }
});

// Flutter wallet information
router.get('/wallet/balance', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024');

    // Mock wallet data (integrate with actual wallet system)
    const walletData = {
      balance: 250.75,
      currency: decoded.currency || 'INR',
      totalDeposits: 500.0,
      totalWithdrawals: 200.0,
      totalWinnings: 448.0,
      pendingWithdrawals: 0,
      lastTransaction: {
        id: 'txn_flutter_001',
        type: 'win',
        amount: 16.0,
        timestamp: Date.now() - 3600000
      },
      paymentMethods: {
        deposits: ['UPI', 'Cards', 'NetBanking'],
        withdrawals: ['UPI', 'BankTransfer']
      }
    };

    res.json({ success: true, wallet: walletData });

  } catch (error) {
    flutterLogger.error('Flutter wallet balance error', { error: error.message });
    res.status(500).json({ error: 'Wallet balance failed', code: 'WALLET_BALANCE_ERROR' });
  }
});

// Flutter match finding
router.post('/match/find-opponent', [
  body('gameType').isIn(['chess', 'snakeLadder', 'carrom']).withMessage('Valid game type required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024');
    const { gameType } = req.body;

    // Mock match finding (integrate with actual match system)
    const matchId = 'flutter_match_' + Date.now();
    const opponentFound = Math.random() > 0.3; // 70% chance of finding opponent

    if (opponentFound) {
      const matchData = {
        matchId,
        gameType,
        playerIds: [decoded.userId, 'opponent_' + Math.floor(Math.random() * 1000)],
        betAmount: 10,
        currency: decoded.currency || 'INR',
        estimatedWinning: 16,
        startTime: Date.now() + 10000, // Start in 10 seconds
        duration: 60,
        status: 'starting'
      };

      flutterLogger.info('Flutter match found', { matchId, gameType, userId: decoded.userId });

      res.json({
        success: true,
        matchFound: true,
        match: matchData,
        countdown: 10
      });
    } else {
      res.json({
        success: true,
        matchFound: false,
        status: 'searching',
        estimatedWait: 30,
        queuePosition: Math.floor(Math.random() * 5) + 1
      });
    }

  } catch (error) {
    flutterLogger.error('Flutter match finding error', { error: error.message });
    res.status(500).json({ error: 'Match finding failed', code: 'MATCH_FIND_ERROR' });
  }
});

// Flutter transaction history
router.get('/transactions/history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024');
    const { page = 1, limit = 20 } = req.query;

    // Mock transaction data
    const transactions = [
      {
        id: 'txn_flutter_001',
        type: 'win',
        amount: 16.0,
        currency: decoded.currency || 'INR',
        gameType: 'chess',
        status: 'completed',
        timestamp: Date.now() - 3600000,
        description: 'Chess match victory'
      },
      {
        id: 'txn_flutter_002',
        type: 'deposit',
        amount: 100.0,
        currency: decoded.currency || 'INR',
        paymentMethod: 'UPI',
        status: 'completed',
        timestamp: Date.now() - 7200000,
        description: 'Wallet deposit via UPI'
      },
      {
        id: 'txn_flutter_003',
        type: 'loss',
        amount: 10.0,
        currency: decoded.currency || 'INR',
        gameType: 'carrom',
        status: 'completed',
        timestamp: Date.now() - 10800000,
        description: 'Carrom match participation'
      }
    ];

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: transactions.length,
        hasMore: false
      }
    });

  } catch (error) {
    flutterLogger.error('Flutter transaction history error', { error: error.message });
    res.status(500).json({ error: 'Transaction history failed', code: 'TRANSACTION_HISTORY_ERROR' });
  }
});

// Flutter app feedback
router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('feedback').isLength({ min: 1, max: 1000 }).withMessage('Feedback must be 1-1000 characters'),
  body('category').optional().isIn(['bug', 'feature', 'gameplay', 'payment', 'other']).withMessage('Valid category required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { rating, feedback, category = 'other' } = req.body;

    flutterLogger.info('Flutter app feedback received', {
      rating,
      category,
      feedback: feedback.substring(0, 100) + '...',
      deviceId: req.deviceInfo.deviceId,
      appVersion: req.deviceInfo.appVersion
    });

    res.json({
      success: true,
      message: 'Thank you for your feedback!',
      feedbackId: 'feedback_' + Date.now()
    });

  } catch (error) {
    flutterLogger.error('Flutter feedback error', { error: error.message });
    res.status(500).json({ error: 'Feedback submission failed', code: 'FEEDBACK_ERROR' });
  }
});

// Flutter app version check
router.get('/version/check', async (req, res) => {
  try {
    const currentVersion = req.deviceInfo.appVersion;
    const latestVersion = '1.0.0';
    const minimumVersion = '1.0.0';

    const updateRequired = currentVersion < minimumVersion;
    const updateAvailable = currentVersion < latestVersion;

    res.json({
      success: true,
      currentVersion,
      latestVersion,
      minimumVersion,
      updateRequired,
      updateAvailable,
      updateUrl: 'https://play.google.com/store/apps/details?id=com.skillzyarena.app',
      releaseNotes: [
        'Improved match finding speed',
        'Fixed wallet synchronization issues',
        'Added new game tutorials',
        'Enhanced security features'
      ]
    });

  } catch (error) {
    flutterLogger.error('Flutter version check error', { error: error.message });
    res.status(500).json({ error: 'Version check failed', code: 'VERSION_CHECK_ERROR' });
  }
});

// Flutter notification registration
router.post('/notifications/register', [
  body('fcmToken').isLength({ min: 1 }).withMessage('FCM token required'),
  body('preferences').optional().isObject().withMessage('Preferences must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { fcmToken, preferences = {} } = req.body;
    const deviceId = req.deviceInfo.deviceId;

    flutterLogger.info('Flutter FCM token registered', { deviceId, fcmToken: fcmToken.substring(0, 20) + '...' });

    res.json({
      success: true,
      message: 'Notifications registered successfully',
      preferences: {
        matchUpdates: preferences.matchUpdates !== false,
        walletUpdates: preferences.walletUpdates !== false,
        promotions: preferences.promotions !== false,
        security: preferences.security !== false
      }
    });

  } catch (error) {
    flutterLogger.error('Flutter notification registration error', { error: error.message });
    res.status(500).json({ error: 'Notification registration failed', code: 'NOTIFICATION_ERROR' });
  }
});

module.exports = router;