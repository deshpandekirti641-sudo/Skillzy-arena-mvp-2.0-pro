#!/usr/bin/env node

/**
 * SKILLZY ARENA - WITHDRAWAL PROCESSING SCRIPT
 * Automated withdrawal processing and batch operations
 */

const winston = require('winston');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/withdrawal-processing.log' }),
    new winston.transports.Console()
  ]
});

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'noreply@skillzyarena.com',
    pass: process.env.EMAIL_PASS || 'your_app_password'
  }
});

// Withdrawal processing configuration
const PROCESSING_CONFIG = {
  batchSize: 100,
  maxRetries: 3,
  timeoutMs: 30000,
  supportedMethods: ['UPI', 'BankTransfer', 'Cards', 'PIX', 'Alipay', 'PayPal'],
  limits: {
    minAmount: { INR: 100, USD: 5, EUR: 5 },
    maxAmount: { INR: 200000, USD: 2500, EUR: 2200 },
    dailyLimit: { INR: 500000, USD: 6000, EUR: 5500 }
  }
};

// Mock payment gateways (replace with real implementations)
const PAYMENT_GATEWAYS = {
  razorpay: {
    processWithdrawal: async (withdrawalData) => {
      // Mock Razorpay withdrawal processing
      logger.info('Processing Razorpay withdrawal', { 
        withdrawalId: withdrawalData.id,
        amount: withdrawalData.amount,
        currency: withdrawalData.currency
      });
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 95% success rate simulation
      const success = Math.random() > 0.05;
      
      if (success) {
        return {
          success: true,
          gatewayTransactionId: 'rzp_' + crypto.randomBytes(8).toString('hex'),
          processingTime: 2000,
          estimatedSettlement: '2-4 hours'
        };
      } else {
        throw new Error('Gateway processing failed');
      }
    }
  },
  
  stripe: {
    processWithdrawal: async (withdrawalData) => {
      logger.info('Processing Stripe withdrawal', { 
        withdrawalId: withdrawalData.id,
        amount: withdrawalData.amount,
        currency: withdrawalData.currency
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const success = Math.random() > 0.03;
      
      if (success) {
        return {
          success: true,
          gatewayTransactionId: 'str_' + crypto.randomBytes(8).toString('hex'),
          processingTime: 3000,
          estimatedSettlement: '3-7 business days'
        };
      } else {
        throw new Error('Stripe processing failed');
      }
    }
  },
  
  paypal: {
    processWithdrawal: async (withdrawalData) => {
      logger.info('Processing PayPal withdrawal', { 
        withdrawalId: withdrawalData.id,
        amount: withdrawalData.amount,
        currency: withdrawalData.currency
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const success = Math.random() > 0.02;
      
      if (success) {
        return {
          success: true,
          gatewayTransactionId: 'pp_' + crypto.randomBytes(8).toString('hex'),
          processingTime: 1500,
          estimatedSettlement: '24-48 hours'
        };
      } else {
        throw new Error('PayPal processing failed');
      }
    }
  }
};

// Load mock withdrawal queue
async function loadWithdrawalQueue() {
  try {
    // In production, this would come from database
    const mockWithdrawals = [
      {
        id: 'wd_1234567890ab',
        userId: 'user_001',
        amount: 500.0,
        currency: 'INR',
        withdrawalMethod: 'UPI',
        withdrawalDetails: {
          upiId: 'user@paytm',
          accountHolderName: 'John Doe'
        },
        status: 'approved',
        approvedAt: Date.now() - 300000, // 5 minutes ago
        gateway: 'razorpay',
        retryCount: 0
      },
      {
        id: 'wd_2345678901bc',
        userId: 'user_002',
        amount: 25.0,
        currency: 'USD',
        withdrawalMethod: 'PayPal',
        withdrawalDetails: {
          paypalEmail: 'user@example.com'
        },
        status: 'approved',
        approvedAt: Date.now() - 600000, // 10 minutes ago
        gateway: 'paypal',
        retryCount: 0
      },
      {
        id: 'wd_3456789012cd',
        userId: 'user_003',
        amount: 1000.0,
        currency: 'INR',
        withdrawalMethod: 'BankTransfer',
        withdrawalDetails: {
          accountNumber: '1234567890',
          ifscCode: 'HDFC0001234',
          accountHolderName: 'Jane Smith'
        },
        status: 'approved',
        approvedAt: Date.now() - 900000, // 15 minutes ago
        gateway: 'razorpay',
        retryCount: 1 // Previously failed once
      }
    ];

    return mockWithdrawals.filter(w => w.status === 'approved');
  } catch (error) {
    logger.error('Failed to load withdrawal queue', { error: error.message });
    return [];
  }
}

// Process individual withdrawal
async function processWithdrawal(withdrawal) {
  try {
    logger.info('Starting withdrawal processing', { 
      withdrawalId: withdrawal.id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      method: withdrawal.withdrawalMethod,
      retryCount: withdrawal.retryCount
    });

    // Validate withdrawal data
    if (!withdrawal.id || !withdrawal.userId || !withdrawal.amount) {
      throw new Error('Invalid withdrawal data');
    }

    // Check amount limits
    const currencyLimits = PROCESSING_CONFIG.limits;
    if (withdrawal.amount < currencyLimits.minAmount[withdrawal.currency] ||
        withdrawal.amount > currencyLimits.maxAmount[withdrawal.currency]) {
      throw new Error('Amount outside allowed limits');
    }

    // Select appropriate gateway
    const gateway = PAYMENT_GATEWAYS[withdrawal.gateway];
    if (!gateway) {
      throw new Error(`Unsupported gateway: ${withdrawal.gateway}`);
    }

    // Update status to processing
    withdrawal.status = 'processing';
    withdrawal.processingStarted = Date.now();

    // Process through gateway
    const result = await Promise.race([
      gateway.processWithdrawal(withdrawal),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), PROCESSING_CONFIG.timeoutMs)
      )
    ]);

    // Update withdrawal with success result
    withdrawal.status = 'completed';
    withdrawal.completedAt = Date.now();
    withdrawal.gatewayTransactionId = result.gatewayTransactionId;
    withdrawal.processingTime = result.processingTime;
    withdrawal.estimatedSettlement = result.estimatedSettlement;

    // Send success notification
    await sendWithdrawalNotification(withdrawal, 'completed');

    logger.info('Withdrawal processed successfully', {
      withdrawalId: withdrawal.id,
      gatewayTransactionId: result.gatewayTransactionId,
      processingTime: result.processingTime
    });

    return { success: true, withdrawal };

  } catch (error) {
    logger.error('Withdrawal processing failed', {
      withdrawalId: withdrawal.id,
      error: error.message,
      retryCount: withdrawal.retryCount
    });

    // Update withdrawal with failure information
    withdrawal.status = 'failed';
    withdrawal.failedAt = Date.now();
    withdrawal.failureReason = error.message;
    withdrawal.retryCount = (withdrawal.retryCount || 0) + 1;

    // Determine if retry is possible
    if (withdrawal.retryCount < PROCESSING_CONFIG.maxRetries) {
      withdrawal.status = 'retry_scheduled';
      withdrawal.nextRetryAt = Date.now() + (withdrawal.retryCount * 60 * 60 * 1000); // Exponential backoff
      
      logger.info('Withdrawal scheduled for retry', {
        withdrawalId: withdrawal.id,
        retryCount: withdrawal.retryCount,
        nextRetryAt: new Date(withdrawal.nextRetryAt).toISOString()
      });
    } else {
      // Max retries exceeded - send failure notification
      await sendWithdrawalNotification(withdrawal, 'failed');
    }

    return { success: false, withdrawal, error: error.message };
  }
}

// Send withdrawal notification email
async function sendWithdrawalNotification(withdrawal, status) {
  try {
    const userEmail = `user${withdrawal.userId.replace('user_', '')}@example.com`; // Mock email
    let subject, html;

    if (status === 'completed') {
      subject = `✅ Skillzy Arena - Withdrawal Completed`;
      html = `
        <h2>Withdrawal Completed Successfully!</h2>
        <p>Your withdrawal has been processed and sent to your ${withdrawal.withdrawalMethod} account.</p>
        <h3>Transaction Details:</h3>
        <ul>
          <li><strong>Withdrawal ID:</strong> ${withdrawal.id}</li>
          <li><strong>Amount:</strong> ${withdrawal.currency} ${withdrawal.amount}</li>
          <li><strong>Method:</strong> ${withdrawal.withdrawalMethod}</li>
          <li><strong>Transaction ID:</strong> ${withdrawal.gatewayTransactionId}</li>
          <li><strong>Estimated Settlement:</strong> ${withdrawal.estimatedSettlement}</li>
        </ul>
        <p>Thank you for playing on Skillzy Arena!</p>
      `;
    } else if (status === 'failed') {
      subject = `❌ Skillzy Arena - Withdrawal Failed`;
      html = `
        <h2>Withdrawal Processing Failed</h2>
        <p>We were unable to process your withdrawal after multiple attempts.</p>
        <h3>Transaction Details:</h3>
        <ul>
          <li><strong>Withdrawal ID:</strong> ${withdrawal.id}</li>
          <li><strong>Amount:</strong> ${withdrawal.currency} ${withdrawal.amount}</li>
          <li><strong>Method:</strong> ${withdrawal.withdrawalMethod}</li>
          <li><strong>Failure Reason:</strong> ${withdrawal.failureReason}</li>
        </ul>
        <p>The amount has been credited back to your wallet. Please contact support for assistance.</p>
        <p>Support Email: support@skillzyarena.com</p>
      `;
    }

    await emailTransporter.sendMail({
      from: 'Skillzy Arena <noreply@skillzyarena.com>',
      to: userEmail,
      subject,
      html
    });

    logger.info('Withdrawal notification sent', {
      withdrawalId: withdrawal.id,
      status,
      email: userEmail
    });

  } catch (error) {
    logger.error('Failed to send withdrawal notification', {
      withdrawalId: withdrawal.id,
      error: error.message
    });
  }
}

// Generate withdrawal processing report
async function generateProcessingReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    successRate: ((results.filter(r => r.success).length / results.length) * 100).toFixed(2) + '%',
    totalAmount: results.reduce((sum, r) => sum + r.withdrawal.amount, 0),
    byGateway: {},
    byCurrency: {},
    processingTimes: []
  };

  // Group by gateway
  results.forEach(result => {
    const gateway = result.withdrawal.gateway;
    if (!report.byGateway[gateway]) {
      report.byGateway[gateway] = { count: 0, successful: 0, failed: 0 };
    }
    report.byGateway[gateway].count++;
    if (result.success) {
      report.byGateway[gateway].successful++;
      if (result.withdrawal.processingTime) {
        report.processingTimes.push(result.withdrawal.processingTime);
      }
    } else {
      report.byGateway[gateway].failed++;
    }
  });

  // Group by currency
  results.forEach(result => {
    const currency = result.withdrawal.currency;
    if (!report.byCurrency[currency]) {
      report.byCurrency[currency] = { count: 0, totalAmount: 0 };
    }
    report.byCurrency[currency].count++;
    report.byCurrency[currency].totalAmount += result.withdrawal.amount;
  });

  // Calculate average processing time
  if (report.processingTimes.length > 0) {
    report.averageProcessingTime = Math.round(
      report.processingTimes.reduce((sum, time) => sum + time, 0) / report.processingTimes.length
    ) + 'ms';
  }

  // Save report to file
  const reportPath = path.join(__dirname, '..', 'logs', `withdrawal-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  logger.info('Withdrawal processing report generated', {
    reportPath,
    totalProcessed: report.totalProcessed,
    successRate: report.successRate
  });

  return report;
}

// Main processing function
async function processWithdrawals() {
  try {
    logger.info('Starting withdrawal processing batch');

    // Load approved withdrawals from queue
    const withdrawals = await loadWithdrawalQueue();
    
    if (withdrawals.length === 0) {
      logger.info('No withdrawals to process');
      return;
    }

    logger.info(`Processing ${withdrawals.length} withdrawals`);

    // Process withdrawals in batches
    const results = [];
    for (let i = 0; i < withdrawals.length; i += PROCESSING_CONFIG.batchSize) {
      const batch = withdrawals.slice(i, i + PROCESSING_CONFIG.batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / PROCESSING_CONFIG.batchSize) + 1}`, {
        batchSize: batch.length,
        startIndex: i
      });

      // Process batch in parallel
      const batchPromises = batch.map(withdrawal => processWithdrawal(withdrawal));
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            withdrawal: batch[index],
            error: result.reason.message
          });
        }
      });

      // Small delay between batches
      if (i + PROCESSING_CONFIG.batchSize < withdrawals.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Generate processing report
    const report = await generateProcessingReport(results);

    logger.info('Withdrawal processing completed', {
      totalProcessed: report.totalProcessed,
      successful: report.successful,
      failed: report.failed,
      successRate: report.successRate
    });

    console.log('\n📊 WITHDRAWAL PROCESSING REPORT');
    console.log('================================');
    console.log(`Total Processed: ${report.totalProcessed}`);
    console.log(`Successful: ${report.successful}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Success Rate: ${report.successRate}`);
    console.log(`Total Amount: ${Object.values(report.byCurrency).reduce((sum, curr) => sum + curr.totalAmount, 0).toFixed(2)}`);
    if (report.averageProcessingTime) {
      console.log(`Average Processing Time: ${report.averageProcessingTime}`);
    }

  } catch (error) {
    logger.error('Withdrawal processing failed', { error: error.message });
    console.error('❌ Withdrawal processing failed:', error.message);
    process.exit(1);
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Skillzy Arena - Withdrawal Processing Script

Usage: node scripts/process-withdrawals.js [options]

Options:
  --help, -h     Show help
  --dry-run      Show what would be processed without actually processing
  --batch-size   Set batch size (default: 100)
  --verbose      Enable verbose logging

Examples:
  node scripts/process-withdrawals.js
  node scripts/process-withdrawals.js --dry-run
  node scripts/process-withdrawals.js --batch-size 50 --verbose
    `);
    process.exit(0);
  }

  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No actual processing will occur');
    loadWithdrawalQueue().then(withdrawals => {
      console.log(`Would process ${withdrawals.length} withdrawals:`);
      withdrawals.forEach(w => {
        console.log(`- ${w.id}: ${w.currency} ${w.amount} via ${w.withdrawalMethod}`);
      });
    });
    return;
  }

  // Set batch size if provided
  if (args.includes('--batch-size')) {
    const batchIndex = args.indexOf('--batch-size');
    const batchSize = parseInt(args[batchIndex + 1]);
    if (batchSize && batchSize > 0) {
      PROCESSING_CONFIG.batchSize = batchSize;
    }
  }

  // Enable verbose logging
  if (args.includes('--verbose')) {
    logger.level = 'debug';
  }

  // Run withdrawal processing
  processWithdrawals().catch(error => {
    logger.error('Script execution failed', { error: error.message });
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}