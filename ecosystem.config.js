/**
 * SKILLZY ARENA - PM2 ECOSYSTEM CONFIGURATION
 * Production deployment and process management
 */

module.exports = {
  apps: [
    {
      // Main application server
      name: 'skillzy-arena-app',
      script: 'index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      // Process management
      min_uptime: '10s',
      max_restarts: 5,
      kill_timeout: 5000,
      restart_delay: 4000,
      // Memory management
      max_memory_restart: '1G',
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'data'],
      // Logs
      log_file: './logs/skillzy-arena-app.log',
      out_file: './logs/skillzy-arena-app-out.log',
      error_file: './logs/skillzy-arena-app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },

    {
      // Withdrawal processing worker
      name: 'skillzy-withdrawal-processor',
      script: 'scripts/process-withdrawals.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 */6 * * *', // Every 6 hours
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/withdrawal-processor.log',
      out_file: './logs/withdrawal-processor-out.log',
      error_file: './logs/withdrawal-processor-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    {
      // Database cleanup worker
      name: 'skillzy-db-cleanup',
      script: 'scripts/db-cleanup.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 2 * * *', // Every day at 2 AM
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/db-cleanup.log',
      out_file: './logs/db-cleanup-out.log',
      error_file: './logs/db-cleanup-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    {
      // Analytics aggregator
      name: 'skillzy-analytics',
      script: 'scripts/analytics-aggregator.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 */4 * * *', // Every 4 hours
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/analytics.log',
      out_file: './logs/analytics-out.log',
      error_file: './logs/analytics-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    {
      // Flutter app server (for mobile integration)
      name: 'skillzy-flutter-server',
      script: 'flutter-server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      },
      min_uptime: '10s',
      max_restarts: 5,
      kill_timeout: 5000,
      max_memory_restart: '512M',
      watch: false,
      log_file: './logs/flutter-server.log',
      out_file: './logs/flutter-server-out.log',
      error_file: './logs/flutter-server-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    {
      // Health check monitor
      name: 'skillzy-health-monitor',
      script: 'scripts/health-monitor.js',
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 10000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        CHECK_INTERVAL: 30000 // 30 seconds
      },
      log_file: './logs/health-monitor.log',
      out_file: './logs/health-monitor-out.log',
      error_file: './logs/health-monitor-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/skillzy-arena.git',
      path: '/var/www/skillzy-arena',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      ssh_options: 'StrictHostKeyChecking=no'
    },

    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/skillzy-arena.git',
      path: '/var/www/skillzy-arena-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      ssh_options: 'StrictHostKeyChecking=no'
    }
  }
};

