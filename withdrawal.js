/**
 * SKILLZY ARENA - WITHDRAWAL SYSTEM
 * Professional withdrawal processing and management
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const winston = require('winston');

const router = express.Router();

// Withdrawal system logger
const withdrawalLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/withdrawals.log' }),
    new winston.transports.Console()
  ]
});

// Ultra-strict rate limiting for withdrawals
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2, // Only 2 withdrawal requests per hour
  message: { error: 'Maximum withdrawal requests exceeded', code: 'WITHDRAWAL_LIMIT_EXCEEDED' }
});

// In-memory storage (replace with database in production)
const withdrawalRequests = new Map();
const processingQueue = new Map();
const completedWithdrawals = new Map();

// Withdrawal configuration
const WITHDRAWAL_CONFIG = {
  minAmount: {
    INR: 100,
    USD: 5,
    EUR: 5,
    GBP: 4,
    CNY: 30,
    JPY: 500,
    KRW: 6000,
    BRL: 25,
    RUB: 350,
    AED: 18,
    SAR: 19,
    CAD: 7,
    AUD: 7
  },
  maxAmount: {
    INR: 200000,
    USD: 2500,
    EUR: 2200,
    GBP: 1900,
    CNY: 17000,
    JPY: 350000,
    KRW: 3200000,
    BRL: 13000,
    RUB: 180000,
    AED: 9200,
    SAR: 9400,
    CAD: 3300,
    AUD: 3600
  },
  processingFees: {
    UPI: 0,
    BankTransfer: 0,
    Cards: 0.02,
    PIX: 0.01,
    Alipay: 0.015,
    PayPal: 0.035
  },
  processingTimes: {
    UPI: '2-4 hours',
    BankTransfer: '6-24 hours',
    Cards: '3-7 days',
    PIX: '1-2 hours',
    Alipay: '2-6 hours',
    PayPal: '24-48 hours'
  }
};

// Currency conversion rates
const CURRENCY_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  CNY: 0.086,
  JPY: 1.8,
  KRW: 16.2,
  BRL: 0.062,
  RUB: 1.1,
  AED: 0.044,
  SAR: 0.045,
  CAD: 0.016,
  AUD: 0.018
};

// Helper functions
const generateWithdrawalId = () => 'wd_' + uuidv4().substring(0, 12);
const convertCurrency = (amount, from, to) => {
  const inrAmount = amount / CURRENCY_RATES[from];
  return Math.round(inrAmount * CURRENCY_RATES[to] * 100) / 100;
};

const validateBankDetails = (method, details) => {
  switch (method) {
    case 'UPI':
      return details.upiId && /^[\w.-]+@[\w.-]+$/.test(details.upiId);
    case 'BankTransfer':
      return details.accountNumber && 
             details.ifscCode && 
             details.accountHolderName &&
             details.accountNumber.length >= 9 &&
             details.ifscCode.length === 11;
    case 'Cards':
      return details.cardNumber && 
             details.cardHolderName &&
             details.cardNumber.length >= 13;
    case 'PIX':
      return details.pixKey;
    case 'Alipay':
      return details.alipayAccount;
    case 'PayPal':
      return details.paypalEmail && 
             /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.paypalEmail);
    default:
      return false;
  }
};

// Apply rate limiting
router.use(withdrawalLimiter);

// Request withdrawal
router.post('/request', [
  body('userId').isLength({ min: 1 }).withMessage('User ID required'),
  body('amount').isFloat({ min: 1 }).withMessage('Valid amount required'),
  body('currency').isIn(Object.keys(CURRENCY_RATES)).withMessage('Valid currency required'),
  body('withdrawalMethod').isIn(['UPI', 'BankTransfer', 'Cards', 'PIX', 'Alipay', 'PayPal']).withMessage('Valid withdrawal method required'),
  body('withdrawalDetails').isObject().withMessage('Withdrawal details required'),
  body('kycStatus').optional().isIn(['pending', 'verified', 'rejected']).withMessage('Valid KYC status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { userId, amount, currency, withdrawalMethod, withdrawalDetails, kycStatus = 'pending' } = req.body;

    // Validate amount limits
    const minAmount = WITHDRAWAL_CONFIG.minAmount[currency];
    const maxAmount = WITHDRAWAL_CONFIG.maxAmount[currency];

    if (amount < minAmount || amount > maxAmount) {
      return res.status(400).json({
        error: `Withdrawal amount must be between ${minAmount} and ${maxAmount} ${currency}`,
        code: 'AMOUNT_OUT_OF_RANGE'
      });
    }

    // Check KYC requirements for large withdrawals
    const amountInINR = convertCurrency(amount, currency, 'INR');
    if (amountInINR > 10000 && kycStatus !== 'verified') {
      return res.status(400).json({
        error: 'KYC verification required for withdrawals above ₹10,000',
        code: 'KYC_REQUIRED',
        kycStatus,
        requiredForAmount: '₹10,000+'
      });
    }

    // Validate withdrawal details
    if (!validateBankDetails(withdrawalMethod, withdrawalDetails)) {
      return res.status(400).json({
        error: 'Invalid withdrawal details for selected method',
        code: 'INVALID_WITHDRAWAL_DETAILS'
      });
    }

    // Check for duplicate recent requests
    const recentRequests = Array.from(withdrawalRequests.values())
      .filter(req => req.userId === userId && 
                    req.timestamp > Date.now() - (60 * 60 * 1000) && // Last hour
                    req.status !== 'cancelled');

    if (recentRequests.length >= 2) {
      return res.status(429).json({
        error: 'Maximum withdrawal requests per hour exceeded',
        code: 'WITHDRAWAL_FREQUENCY_EXCEEDED'
      });
    }

    // Calculate processing fee
    const feeRate = WITHDRAWAL_CONFIG.processingFees[withdrawalMethod];
    const processingFee = Math.round(amount * feeRate * 100) / 100;
    const netAmount = amount - processingFee;

    // Create withdrawal request
    const withdrawalId = generateWithdrawalId();
    const withdrawalRequest = {
      id: withdrawalId,
      userId,
      amount,
      netAmount,
      processingFee,
      currency,
      withdrawalMethod,
      withdrawalDetails: {
        ...withdrawalDetails,
        // Mask sensitive information in logs
        maskedDetails: maskSensitiveDetails(withdrawalMethod, withdrawalDetails)
      },
      status: 'pending_approval',
      kycStatus,
      timestamp: Date.now(),
      estimatedCompletion: Date.now() + getProcessingTimeMs(withdrawalMethod),
      processingTime: WITHDRAWAL_CONFIG.processingTimes[withdrawalMethod],
      securityHash: crypto.createHash('sha256')
        .update(`${withdrawalId}${userId}${amount}${currency}`)
        .digest('hex')
    };

    withdrawalRequests.set(withdrawalId, withdrawalRequest);

    // Add to processing queue for admin approval
    processingQueue.set(withdrawalId, {
      ...withdrawalRequest,
      queuePosition: processingQueue.size + 1,
      priority: amountInINR > 50000 ? 'high' : 'normal'
    });

    withdrawalLogger.info('Withdrawal request created', {
      withdrawalId,
      userId,
      amount,
      currency,
      method: withdrawalMethod,
      kycStatus
    });

    res.json({
      success: true,
      withdrawalId,
      status: 'pending_approval',
      amount,
      netAmount,
      processingFee,
      currency,
      withdrawalMethod,
      estimatedProcessingTime: WITHDRAWAL_CONFIG.processingTimes[withdrawalMethod],
      message: 'Withdrawal request submitted for approval'
    });

  } catch (error) {
    withdrawalLogger.error('Withdrawal request error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal request failed', code: 'WITHDRAWAL_REQUEST_ERROR' });
  }
});

// Get withdrawal status
router.get('/:withdrawalId/status', [
  param('withdrawalId').matches(/^wd_[a-zA-Z0-9]{12}$/).withMessage('Valid withdrawal ID required')
], async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    
    let withdrawal = withdrawalRequests.get(withdrawalId) || 
                    processingQueue.get(withdrawalId) || 
                    completedWithdrawals.get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found', code: 'WITHDRAWAL_NOT_FOUND' });
    }

    const statusResponse = {
      id: withdrawal.id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      netAmount: withdrawal.netAmount,
      currency: withdrawal.currency,
      withdrawalMethod: withdrawal.withdrawalMethod,
      timestamp: withdrawal.timestamp,
      estimatedCompletion: withdrawal.estimatedCompletion,
      processingTime: withdrawal.processingTime
    };

    // Add status-specific information
    switch (withdrawal.status) {
      case 'pending_approval':
        statusResponse.queuePosition = withdrawal.queuePosition;
        statusResponse.message = 'Withdrawal pending admin approval';
        break;
      case 'approved':
        statusResponse.message = 'Withdrawal approved, processing payment';
        break;
      case 'processing':
        statusResponse.message = 'Payment being processed by gateway';
        statusResponse.gatewayReference = withdrawal.gatewayReference;
        break;
      case 'completed':
        statusResponse.message = 'Withdrawal completed successfully';
        statusResponse.completedAt = withdrawal.completedAt;
        statusResponse.gatewayReference = withdrawal.gatewayReference;
        break;
      case 'failed':
        statusResponse.message = 'Withdrawal failed';
        statusResponse.failureReason = withdrawal.failureReason;
        break;
      case 'cancelled':
        statusResponse.message = 'Withdrawal cancelled';
        statusResponse.cancelledAt = withdrawal.cancelledAt;
        statusResponse.cancelReason = withdrawal.cancelReason;
        break;
    }

    res.json({ success: true, withdrawal: statusResponse });

  } catch (error) {
    withdrawalLogger.error('Withdrawal status error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal status check failed', code: 'WITHDRAWAL_STATUS_ERROR' });
  }
});

// Cancel withdrawal (user action)
router.post('/:withdrawalId/cancel', [
  param('withdrawalId').matches(/^wd_[a-zA-Z0-9]{12}$/).withMessage('Valid withdrawal ID required'),
  body('userId').isLength({ min: 1 }).withMessage('User ID required'),
  body('reason').optional().isLength({ max: 200 }).withMessage('Reason too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { withdrawalId } = req.params;
    const { userId, reason = 'User cancelled' } = req.body;

    const withdrawal = withdrawalRequests.get(withdrawalId) || processingQueue.get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found', code: 'WITHDRAWAL_NOT_FOUND' });
    }

    if (withdrawal.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized cancellation attempt', code: 'UNAUTHORIZED_CANCELLATION' });
    }

    if (withdrawal.status !== 'pending_approval' && withdrawal.status !== 'approved') {
      return res.status(400).json({
        error: 'Withdrawal cannot be cancelled in current status',
        code: 'CANCELLATION_NOT_ALLOWED',
        currentStatus: withdrawal.status
      });
    }

    // Update withdrawal status
    withdrawal.status = 'cancelled';
    withdrawal.cancelledAt = Date.now();
    withdrawal.cancelReason = reason;
    withdrawal.cancelledBy = userId;

    // Remove from processing queue
    processingQueue.delete(withdrawalId);
    withdrawalRequests.delete(withdrawalId);
    completedWithdrawals.set(withdrawalId, withdrawal);

    withdrawalLogger.info('Withdrawal cancelled', {
      withdrawalId,
      userId,
      reason,
      amount: withdrawal.amount,
      currency: withdrawal.currency
    });

    res.json({
      success: true,
      withdrawalId,
      status: 'cancelled',
      cancelledAt: withdrawal.cancelledAt,
      message: 'Withdrawal cancelled successfully'
    });

  } catch (error) {
    withdrawalLogger.error('Withdrawal cancellation error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal cancellation failed', code: 'WITHDRAWAL_CANCEL_ERROR' });
  }
});

// Get user's withdrawal history
router.get('/history/:userId', [
  param('userId').isLength({ min: 1 }).withMessage('User ID required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Valid limit required'),
  query('status').optional().isIn(['pending_approval', 'approved', 'processing', 'completed', 'failed', 'cancelled']).withMessage('Valid status required')
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Collect withdrawals from all sources
    const allWithdrawals = [
      ...Array.from(withdrawalRequests.values()),
      ...Array.from(processingQueue.values()),
      ...Array.from(completedWithdrawals.values())
    ];

    // Filter by user and status
    let userWithdrawals = allWithdrawals.filter(w => w.userId === userId);
    
    if (status) {
      userWithdrawals = userWithdrawals.filter(w => w.status === status);
    }

    // Sort by timestamp (newest first)
    userWithdrawals.sort((a, b) => b.timestamp - a.timestamp);

    // Remove duplicates (same withdrawal in multiple maps)
    const uniqueWithdrawals = userWithdrawals.filter((withdrawal, index, arr) => 
      index === arr.findIndex(w => w.id === withdrawal.id)
    );

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWithdrawals = uniqueWithdrawals.slice(startIndex, endIndex);

    // Format response
    const withdrawalSummary = paginatedWithdrawals.map(w => ({
      id: w.id,
      amount: w.amount,
      netAmount: w.netAmount,
      currency: w.currency,
      withdrawalMethod: w.withdrawalMethod,
      status: w.status,
      timestamp: w.timestamp,
      completedAt: w.completedAt,
      cancelledAt: w.cancelledAt,
      processingTime: w.processingTime
    }));

    res.json({
      success: true,
      withdrawals: withdrawalSummary,
      total: uniqueWithdrawals.length,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: endIndex < uniqueWithdrawals.length
    });

  } catch (error) {
    withdrawalLogger.error('Withdrawal history error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal history failed', code: 'WITHDRAWAL_HISTORY_ERROR' });
  }
});

// Admin: Approve withdrawal
router.post('/admin/:withdrawalId/approve', [
  param('withdrawalId').matches(/^wd_[a-zA-Z0-9]{12}$/).withMessage('Valid withdrawal ID required'),
  body('adminId').isLength({ min: 1 }).withMessage('Admin ID required'),
  body('adminNotes').optional().isLength({ max: 500 }).withMessage('Notes too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { withdrawalId } = req.params;
    const { adminId, adminNotes = '' } = req.body;

    const withdrawal = processingQueue.get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found in queue', code: 'WITHDRAWAL_NOT_IN_QUEUE' });
    }

    // Update withdrawal status
    withdrawal.status = 'approved';
    withdrawal.approvedAt = Date.now();
    withdrawal.approvedBy = adminId;
    withdrawal.adminNotes = adminNotes;

    // Move from queue to processing
    processingQueue.delete(withdrawalId);
    withdrawalRequests.set(withdrawalId, withdrawal);

    // Start actual payment processing
    processPayment(withdrawal);

    withdrawalLogger.info('Withdrawal approved by admin', {
      withdrawalId,
      adminId,
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      currency: withdrawal.currency
    });

    res.json({
      success: true,
      withdrawalId,
      status: 'approved',
      message: 'Withdrawal approved and payment processing initiated'
    });

  } catch (error) {
    withdrawalLogger.error('Withdrawal approval error', { error: error.message });
    res.status(500).json({ error: 'Withdrawal approval failed', code: 'WITHDRAWAL_APPROVAL_ERROR' });
  }
});

// Helper functions
const maskSensitiveDetails = (method, details) => {
  switch (method) {
    case 'UPI':
      return { upiId: details.upiId.replace(/(.{3}).*(@.*)/, '$1***$2') };
    case 'BankTransfer':
      return { 
        accountNumber: '***' + details.accountNumber.slice(-4),
        ifscCode: details.ifscCode,
        accountHolderName: details.accountHolderName
      };
    case 'Cards':
      return { 
        cardNumber: '***' + details.cardNumber.slice(-4),
        cardHolderName: details.cardHolderName
      };
    default:
      return { method };
  }
};

const getProcessingTimeMs = (method) => {
  const times = {
    UPI: 4 * 60 * 60 * 1000,      // 4 hours
    BankTransfer: 24 * 60 * 60 * 1000, // 24 hours
    Cards: 7 * 24 * 60 * 60 * 1000,    // 7 days
    PIX: 2 * 60 * 60 * 1000,      // 2 hours
    Alipay: 6 * 60 * 60 * 1000,   // 6 hours
    PayPal: 48 * 60 * 60 * 1000   // 48 hours
  };
  return times[method] || 24 * 60 * 60 * 1000;
};

const processPayment = async (withdrawal) => {
  try {
    withdrawal.status = 'processing';
    withdrawal.processingStarted = Date.now();
    withdrawal.gatewayReference = 'gw_' + uuidv4().substring(0, 12);

    withdrawalLogger.info('Payment processing started', {
      withdrawalId: withdrawal.id,
      gatewayReference: withdrawal.gatewayReference
    });

    // Mock payment processing (integrate with real gateway)
    setTimeout(async () => {
      try {
        // Simulate successful processing (90% success rate)
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
          withdrawal.status = 'completed';
          withdrawal.completedAt = Date.now();
          
          withdrawalLogger.info('Payment completed successfully', {
            withdrawalId: withdrawal.id,
            gatewayReference: withdrawal.gatewayReference
          });
        } else {
          withdrawal.status = 'failed';
          withdrawal.failedAt = Date.now();
          withdrawal.failureReason = 'Gateway processing error';
          
          withdrawalLogger.error('Payment processing failed', {
            withdrawalId: withdrawal.id,
            gatewayReference: withdrawal.gatewayReference,
            reason: withdrawal.failureReason
          });
        }

        // Move to completed withdrawals
        withdrawalRequests.delete(withdrawal.id);
        completedWithdrawals.set(withdrawal.id, withdrawal);

      } catch (error) {
        withdrawal.status = 'failed';
        withdrawal.failureReason = error.message;
        withdrawalLogger.error('Payment processing exception', {
          withdrawalId: withdrawal.id,
          error: error.message
        });
      }
    }, 10000); // 10-second simulation

  } catch (error) {
    withdrawal.status = 'failed';
    withdrawal.failureReason = error.message;
    withdrawalLogger.error('Payment initiation error', {
      withdrawalId: withdrawal.id,
      error: error.message
    });
  }
};

module.exports = { 
  routes: router, 
  withdrawalRequests, 
  processingQueue, 
  completedWithdrawals,
  WITHDRAWAL_CONFIG 
};