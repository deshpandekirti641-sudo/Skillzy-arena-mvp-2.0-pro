/**
 * SKILLZY ARENA - CONFIGURATION SYSTEM
 * Central configuration for the gaming platform
 */

const path = require('path');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Database and SpacetimeDB configuration
const SPACETIMEDB_URL = process.env.SPACETIMEDB_URL || 'https://testnet.spacetimedb.com';
const SPACETIMEDB_IDENTITY = process.env.SPACETIMEDB_IDENTITY || 'skillzy-arena-identity';
const SPACETIMEDB_MODULE_NAME = process.env.SPACETIMEDB_MODULE_NAME || 'skillzy-arena';

// Security configuration
const JWT_SECRET = process.env.JWT_SECRET || 'skillzy_arena_jwt_secret_2024';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'skillzy_admin_secret_2024';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'skillzy_encryption_key_32_chars';

// Payment gateway configuration
const PAYMENT_CONFIG = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret'
  },
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_stripe',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_stripe',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_stripe'
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || 'paypal_client_id',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'paypal_client_secret',
    sandbox: NODE_ENV !== 'production'
  }
};

// Gaming configuration
const GAMING_CONFIG = {
  // Fixed bet amount in INR (₹10)
  fixedBetAmount: 10,
  
  // Payout split (80% to winner, 20% to platform)
  payoutSplit: {
    winner: 80,
    platform: 20
  },
  
  // Match duration (60 seconds)
  matchDuration: 60,
  
  // Maximum concurrent matches
  maxConcurrentMatches: process.env.MAX_CONCURRENT_MATCHES || 1000,
  
  // Game types
  availableGames: ['chess', 'snakeLadder', 'carrom'],
  
  // Match timeout settings
  matchTimeout: {
    findOpponent: 30, // 30 seconds to find opponent
    gameStart: 10,    // 10 seconds before game starts
    gamePlay: 60,     // 60 seconds gameplay
    resultProcess: 5  // 5 seconds to process results
  }
};

// Multi-currency configuration
const CURRENCY_CONFIG = {
  baseCurrency: 'INR',
  supportedCurrencies: [
    'INR', 'USD', 'EUR', 'GBP', 'CNY', 'JPY', 'KRW', 
    'BRL', 'RUB', 'AED', 'SAR', 'CAD', 'AUD'
  ],
  exchangeRateProvider: 'fixer.io',
  exchangeRateAPIKey: process.env.EXCHANGE_RATE_API_KEY || 'fixer_api_key',
  updateInterval: 3600000 // Update rates every hour
};

// Multi-language configuration
const LANGUAGE_CONFIG = {
  defaultLanguage: 'en',
  supportedLanguages: [
    'en', 'hi', 'es', 'fr', 'de', 'zh', 'ar', 'pt', 'ru', 'ja', 'ko'
  ],
  fallbackLanguage: 'en',
  translationProvider: 'google-translate',
  translationAPIKey: process.env.TRANSLATION_API_KEY || 'google_translate_key'
};

// KYC and compliance configuration
const KYC_CONFIG = {
  // KYC thresholds (in INR)
  kycThresholds: {
    deposit: 50000,     // ₹50,000
    withdrawal: 10000,  // ₹10,000
    cumulative: 100000  // ₹1,00,000
  },
  
  // Required documents
  requiredDocuments: [
    'aadhaar', 'pan', 'bank_statement', 'selfie'
  ],
  
  // Verification providers
  verificationProviders: {
    aadhaar: 'aadhaar_api',
    pan: 'pan_verification_api',
    bankAccount: 'penny_drop_api'
  }
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // General API limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  },
  
  // Gaming action limits
  gaming: {
    windowMs: 60 * 1000, // 1 minute
    max: 20 // 20 gaming actions per minute
  },
  
  // Wallet operation limits
  wallet: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10 // 10 wallet operations per 5 minutes
  },
  
  // Admin operation limits
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20 // 20 admin operations per 15 minutes
  },
  
  // Withdrawal limits
  withdrawal: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3 // 3 withdrawal requests per hour
  }
};

// Security configuration
const SECURITY_CONFIG = {
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  },
  
  // Session configuration
  session: {
    duration: 4 * 60 * 60 * 1000, // 4 hours
    inactivityTimeout: 60 * 60 * 1000, // 1 hour
    refreshThreshold: 30 * 60 * 1000 // 30 minutes
  },
  
  // OTP configuration
  otp: {
    length: 6,
    expiryTime: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 3,
    cooldownTime: 15 * 60 * 1000 // 15 minutes after max attempts
  },
  
  // Anti-fraud measures
  antiFraud: {
    maxFailedLogins: 5,
    accountLockDuration: 30 * 60 * 1000, // 30 minutes
    suspiciousActivityThreshold: 10,
    ipWhitelist: [], // Add trusted IPs
    ipBlacklist: [] // Add blocked IPs
  }
};

// Logging configuration
const LOGGING_CONFIG = {
  level: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // File logging
  files: {
    error: path.join(__dirname, 'logs', 'error.log'),
    combined: path.join(__dirname, 'logs', 'combined.log'),
    admin: path.join(__dirname, 'logs', 'admin.log'),
    wallet: path.join(__dirname, 'logs', 'wallet.log'),
    matches: path.join(__dirname, 'logs', 'matches.log'),
    security: path.join(__dirname, 'logs', 'security.log')
  },
  
  // Log rotation
  rotation: {
    maxSize: '20m',
    maxFiles: '14d'
  },
  
  // External logging services
  external: {
    enabled: NODE_ENV === 'production',
    service: 'winston-cloudwatch', // or 'winston-elasticsearch'
    config: {
      logGroupName: 'skillzy-arena-logs',
      logStreamName: 'application-logs'
    }
  }
};

// Email configuration
const EMAIL_CONFIG = {
  provider: 'sendgrid', // or 'ses', 'mailgun'
  apiKey: process.env.EMAIL_API_KEY || 'sendgrid_api_key',
  fromEmail: process.env.FROM_EMAIL || 'noreply@skillzyarena.com',
  fromName: 'Skillzy Arena',
  
  templates: {
    welcome: 'welcome_template_id',
    otp: 'otp_template_id',
    kycApproval: 'kyc_approval_template_id',
    withdrawal: 'withdrawal_template_id'
  }
};

// SMS configuration
const SMS_CONFIG = {
  provider: 'twilio', // or 'aws-sns', 'msg91'
  accountSid: process.env.SMS_ACCOUNT_SID || 'twilio_account_sid',
  authToken: process.env.SMS_AUTH_TOKEN || 'twilio_auth_token',
  fromNumber: process.env.SMS_FROM_NUMBER || '+1234567890',
  
  templates: {
    otp: 'Your Skillzy Arena OTP is: {{otp}}. Valid for 5 minutes.',
    withdrawal: 'Withdrawal of {{amount}} {{currency}} processed successfully.',
    kyc: 'KYC verification completed. You can now withdraw up to ₹50,000.'
  }
};

// Monitoring and analytics configuration
const MONITORING_CONFIG = {
  // Performance monitoring
  performance: {
    enabled: true,
    provider: 'newrelic', // or 'datadog', 'elastic-apm'
    apiKey: process.env.MONITORING_API_KEY || 'monitoring_api_key'
  },
  
  // User analytics
  analytics: {
    enabled: true,
    provider: 'mixpanel', // or 'amplitude', 'google-analytics'
    apiKey: process.env.ANALYTICS_API_KEY || 'analytics_api_key'
  },
  
  // Error tracking
  errorTracking: {
    enabled: true,
    provider: 'sentry',
    dsn: process.env.SENTRY_DSN || 'sentry_dsn_url'
  },
  
  // Health checks
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
    retries: 3
  }
};

// CDN and asset configuration
const ASSET_CONFIG = {
  cdn: {
    enabled: NODE_ENV === 'production',
    provider: 'cloudfront', // or 'cloudflare', 'fastly'
    baseUrl: process.env.CDN_BASE_URL || 'https://cdn.skillzyarena.com',
    cacheTTL: 86400 // 24 hours
  },
  
  // Image optimization
  images: {
    formats: ['webp', 'avif', 'jpeg', 'png'],
    quality: 80,
    sizes: [320, 640, 768, 1024, 1280, 1920],
    placeholder: 'blur'
  },
  
  // Static assets
  staticAssets: {
    maxAge: 31536000, // 1 year
    immutable: true,
    compression: true
  }
};

// Development configuration
const DEVELOPMENT_CONFIG = {
  // Hot reload
  hotReload: NODE_ENV === 'development',
  
  // Debug mode
  debug: NODE_ENV === 'development' || process.env.DEBUG === 'true',
  
  // Mock services
  mockServices: {
    enabled: NODE_ENV === 'development',
    paymentGateway: true,
    smsProvider: true,
    emailProvider: true,
    kycProvider: true
  },
  
  // Testing
  testing: {
    enabled: process.env.NODE_ENV === 'test',
    database: 'test_database',
    resetOnStart: true
  }
};

// Export configuration
module.exports = {
  // Environment
  NODE_ENV,
  PORT,
  HOST,
  
  // URLs and endpoints
  SPACETIMEDB_URL,
  SPACETIMEDB_IDENTITY,
  SPACETIMEDB_MODULE_NAME,
  
  // Security
  JWT_SECRET,
  ADMIN_JWT_SECRET,
  ENCRYPTION_KEY,
  
  // Feature configurations
  GAMING_CONFIG,
  PAYMENT_CONFIG,
  CURRENCY_CONFIG,
  LANGUAGE_CONFIG,
  KYC_CONFIG,
  RATE_LIMIT_CONFIG,
  SECURITY_CONFIG,
  LOGGING_CONFIG,
  EMAIL_CONFIG,
  SMS_CONFIG,
  MONITORING_CONFIG,
  ASSET_CONFIG,
  DEVELOPMENT_CONFIG,
  
  // Allowed origins for CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    [`http://localhost:${PORT}`, `https://skillzyarena.vercel.app`],
  
  // Database URLs (if using traditional databases alongside SpacetimeDB)
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/skillzy_arena',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // External service URLs
  PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || 'https://api.razorpay.com',
  EXCHANGE_RATE_URL: process.env.EXCHANGE_RATE_URL || 'https://api.fixer.io',
  
  // Admin configuration
  ADMIN_CONFIG: {
    validAdminIds: ['dev_skillzy_owner_2024', 'SKILLZY_ADMIN', 'ARENA_OWNER'],
    validMasterCodes: ['SKILLZY2024DEV', 'ARENA_OWNER_ACCESS', 'MASTER_DEV_KEY'],
    sessionDuration: 4 * 60 * 60 * 1000, // 4 hours
    maxConcurrentSessions: 3
  },
  
  // Platform limits
  PLATFORM_LIMITS: {
    maxUsersPerServer: 50000,
    maxConcurrentMatches: 1000,
    maxWalletBalance: 500000, // ₹5,00,000
    maxSingleDeposit: 100000, // ₹1,00,000
    maxSingleWithdrawal: 200000, // ₹2,00,000
    maxDailyWithdrawal: 500000 // ₹5,00,000
  },
  
  // Feature flags
  FEATURE_FLAGS: {
    multiLanguage: true,
    multiCurrency: true,
    kycVerification: true,
    referralSystem: true,
    tournaments: false, // Coming soon
    liveStreaming: false, // Coming soon
    socialFeatures: false // Coming soon
  },
  
  // Version information
  VERSION: '1.0.0',
  BUILD_DATE: new Date().toISOString(),
  COMMIT_HASH: process.env.COMMIT_HASH || 'dev-build'
};