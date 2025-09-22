#!/usr/bin/env node

/**
 * SKILLZY ARENA - ADMIN CREATION SCRIPT
 * Creates and manages admin users for the platform
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const readline = require('readline');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/admin-management.log' }),
    new winston.transports.Console()
  ]
});

// Admin configuration
const ADMIN_CONFIG = {
  saltRounds: 12,
  tokenLength: 32,
  sessionDuration: 4 * 60 * 60 * 1000, // 4 hours
  maxConcurrentSessions: 3,
  roles: ['super_admin', 'admin', 'moderator', 'support'],
  permissions: {
    super_admin: [
      'user_management', 'wallet_management', 'game_control', 'system_settings',
      'withdrawal_approval', 'developer_wallet_access', 'analytics_full',
      'admin_management', 'security_management', 'audit_logs'
    ],
    admin: [
      'user_management', 'wallet_management', 'game_control', 
      'withdrawal_approval', 'analytics_view', 'support_tickets'
    ],
    moderator: [
      'user_management', 'support_tickets', 'game_monitoring', 'basic_analytics'
    ],
    support: [
      'support_tickets', 'user_view', 'basic_analytics'
    ]
  }
};

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to ask questions
function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

// Utility function to ask for hidden input (passwords)
function hiddenQuestion(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

// Generate secure admin credentials
function generateAdminCredentials(username, role) {
  const adminId = `admin_${username}_${Date.now()}`;
  const apiKey = crypto.randomBytes(ADMIN_CONFIG.tokenLength).toString('hex');
  const sessionToken = crypto.randomBytes(ADMIN_CONFIG.tokenLength).toString('hex');
  
  return {
    adminId,
    username,
    role,
    apiKey,
    sessionToken,
    permissions: ADMIN_CONFIG.permissions[role] || [],
    createdAt: Date.now(),
    isActive: true,
    lastLogin: null,
    failedLoginAttempts: 0,
    lockoutUntil: null
  };
}

// Hash password securely
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(ADMIN_CONFIG.saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

// Validate password strength
function validatePassword(password) {
  const requirements = [
    { regex: /.{12,}/, message: 'At least 12 characters long' },
    { regex: /[A-Z]/, message: 'At least one uppercase letter' },
    { regex: /[a-z]/, message: 'At least one lowercase letter' },
    { regex: /[0-9]/, message: 'At least one number' },
    { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/, message: 'At least one special character' }
  ];

  const failedRequirements = requirements.filter(req => !req.regex.test(password));
  
  if (failedRequirements.length > 0) {
    return {
      valid: false,
      messages: failedRequirements.map(req => req.message)
    };
  }

  return { valid: true, messages: [] };
}

// Load existing admins
async function loadAdmins() {
  try {
    const adminPath = path.join(__dirname, '..', 'data', 'admins.json');
    const data = await fs.readFile(adminPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

// Save admins to file
async function saveAdmins(admins) {
  try {
    const adminPath = path.join(__dirname, '..', 'data', 'admins.json');
    const dataDir = path.dirname(adminPath);
    
    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(adminPath, JSON.stringify(admins, null, 2));
    logger.info('Admin data saved successfully', { count: admins.length });
  } catch (error) {
    throw new Error(`Failed to save admin data: ${error.message}`);
  }
}

// Create new admin
async function createAdmin() {
  try {
    console.log('\n🔐 SKILLZY ARENA - ADMIN CREATION');
    console.log('================================\n');

    // Get admin details
    const username = await question('Enter admin username: ');
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    console.log('\nAvailable roles:');
    ADMIN_CONFIG.roles.forEach((role, index) => {
      const permissions = ADMIN_CONFIG.permissions[role] || [];
      console.log(`${index + 1}. ${role} (${permissions.length} permissions)`);
    });

    const roleIndex = await question('\nSelect role (1-4): ');
    const selectedRole = ADMIN_CONFIG.roles[parseInt(roleIndex) - 1];
    if (!selectedRole) {
      throw new Error('Invalid role selection');
    }

    console.log('\nPassword requirements:');
    console.log('- At least 12 characters long');
    console.log('- At least one uppercase letter');
    console.log('- At least one lowercase letter');
    console.log('- At least one number');
    console.log('- At least one special character');

    let password, confirmPassword;
    let passwordValid = false;

    while (!passwordValid) {
      password = await hiddenQuestion('\nEnter admin password: ');
      const validation = validatePassword(password);
      
      if (!validation.valid) {
        console.log('\n❌ Password does not meet requirements:');
        validation.messages.forEach(msg => console.log(`- ${msg}`));
        continue;
      }

      confirmPassword = await hiddenQuestion('Confirm password: ');
      if (password !== confirmPassword) {
        console.log('\n❌ Passwords do not match. Please try again.');
        continue;
      }

      passwordValid = true;
    }

    // Load existing admins
    const existingAdmins = await loadAdmins();

    // Check if username already exists
    if (existingAdmins.some(admin => admin.username === username)) {
      throw new Error('Admin with this username already exists');
    }

    // Generate admin credentials
    const adminData = generateAdminCredentials(username, selectedRole);
    adminData.passwordHash = await hashPassword(password);

    // Add to admins list
    existingAdmins.push(adminData);

    // Save admins
    await saveAdmins(existingAdmins);

    // Log admin creation
    logger.info('New admin created', {
      adminId: adminData.adminId,
      username: adminData.username,
      role: adminData.role,
      permissions: adminData.permissions.length
    });

    console.log('\n✅ Admin created successfully!');
    console.log('\n📋 Admin Details:');
    console.log(`Admin ID: ${adminData.adminId}`);
    console.log(`Username: ${adminData.username}`);
    console.log(`Role: ${adminData.role}`);
    console.log(`API Key: ${adminData.apiKey}`);
    console.log(`Permissions: ${adminData.permissions.join(', ')}`);
    console.log('\n⚠️  Save these credentials securely. The API key will not be shown again.');

    return adminData;

  } catch (error) {
    logger.error('Admin creation failed', { error: error.message });
    throw error;
  }
}

// List existing admins
async function listAdmins() {
  try {
    const admins = await loadAdmins();
    
    if (admins.length === 0) {
      console.log('\n📭 No admins found.');
      return;
    }

    console.log('\n👥 EXISTING ADMINS');
    console.log('==================\n');

    admins.forEach((admin, index) => {
      const status = admin.isActive ? '✅ Active' : '❌ Inactive';
      const lastLogin = admin.lastLogin ? 
        new Date(admin.lastLogin).toLocaleString() : 
        'Never';
      
      console.log(`${index + 1}. ${admin.username}`);
      console.log(`   Admin ID: ${admin.adminId}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${status}`);
      console.log(`   Last Login: ${lastLogin}`);
      console.log(`   Permissions: ${admin.permissions.length}`);
      console.log(`   Created: ${new Date(admin.createdAt).toLocaleString()}`);
      console.log('');
    });

    return admins;

  } catch (error) {
    logger.error('Failed to list admins', { error: error.message });
    throw error;
  }
}

// Update admin role/permissions
async function updateAdmin() {
  try {
    const admins = await loadAdmins();
    
    if (admins.length === 0) {
      console.log('\n📭 No admins found to update.');
      return;
    }

    console.log('\n📝 UPDATE ADMIN');
    console.log('===============\n');

    // Show existing admins
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.username} (${admin.role})`);
    });

    const adminIndex = await question('\nSelect admin to update (number): ');
    const selectedAdmin = admins[parseInt(adminIndex) - 1];
    
    if (!selectedAdmin) {
      throw new Error('Invalid admin selection');
    }

    console.log(`\nUpdating admin: ${selectedAdmin.username}`);
    console.log(`Current role: ${selectedAdmin.role}`);

    console.log('\nAvailable roles:');
    ADMIN_CONFIG.roles.forEach((role, index) => {
      console.log(`${index + 1}. ${role}`);
    });

    const roleIndex = await question('\nSelect new role (1-4, or press Enter to keep current): ');
    
    if (roleIndex) {
      const newRole = ADMIN_CONFIG.roles[parseInt(roleIndex) - 1];
      if (!newRole) {
        throw new Error('Invalid role selection');
      }

      selectedAdmin.role = newRole;
      selectedAdmin.permissions = ADMIN_CONFIG.permissions[newRole] || [];
      selectedAdmin.updatedAt = Date.now();
    }

    const statusUpdate = await question('\nUpdate status? (active/inactive, or press Enter to keep current): ');
    if (statusUpdate) {
      selectedAdmin.isActive = statusUpdate.toLowerCase() === 'active';
    }

    // Save updated admins
    await saveAdmins(admins);

    logger.info('Admin updated', {
      adminId: selectedAdmin.adminId,
      username: selectedAdmin.username,
      role: selectedAdmin.role
    });

    console.log('\n✅ Admin updated successfully!');
    console.log(`Username: ${selectedAdmin.username}`);
    console.log(`New Role: ${selectedAdmin.role}`);
    console.log(`Status: ${selectedAdmin.isActive ? 'Active' : 'Inactive'}`);
    console.log(`Permissions: ${selectedAdmin.permissions.join(', ')}`);

  } catch (error) {
    logger.error('Admin update failed', { error: error.message });
    throw error;
  }
}

// Reset admin password
async function resetPassword() {
  try {
    const admins = await loadAdmins();
    
    if (admins.length === 0) {
      console.log('\n📭 No admins found.');
      return;
    }

    console.log('\n🔑 RESET ADMIN PASSWORD');
    console.log('=======================\n');

    // Show existing admins
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.username} (${admin.role})`);
    });

    const adminIndex = await question('\nSelect admin for password reset (number): ');
    const selectedAdmin = admins[parseInt(adminIndex) - 1];
    
    if (!selectedAdmin) {
      throw new Error('Invalid admin selection');
    }

    console.log(`\nResetting password for: ${selectedAdmin.username}`);

    let newPassword, confirmPassword;
    let passwordValid = false;

    while (!passwordValid) {
      newPassword = await hiddenQuestion('\nEnter new password: ');
      const validation = validatePassword(newPassword);
      
      if (!validation.valid) {
        console.log('\n❌ Password does not meet requirements:');
        validation.messages.forEach(msg => console.log(`- ${msg}`));
        continue;
      }

      confirmPassword = await hiddenQuestion('Confirm new password: ');
      if (newPassword !== confirmPassword) {
        console.log('\n❌ Passwords do not match. Please try again.');
        continue;
      }

      passwordValid = true;
    }

    // Hash new password
    selectedAdmin.passwordHash = await hashPassword(newPassword);
    selectedAdmin.passwordResetAt = Date.now();
    selectedAdmin.failedLoginAttempts = 0;
    selectedAdmin.lockoutUntil = null;

    // Invalidate existing sessions
    selectedAdmin.sessionToken = crypto.randomBytes(ADMIN_CONFIG.tokenLength).toString('hex');

    // Save updated admins
    await saveAdmins(admins);

    logger.info('Admin password reset', {
      adminId: selectedAdmin.adminId,
      username: selectedAdmin.username
    });

    console.log('\n✅ Password reset successfully!');
    console.log('All existing sessions have been invalidated.');

  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    throw error;
  }
}

// Main menu
async function showMenu() {
  while (true) {
    try {
      console.log('\n🎮 SKILLZY ARENA - ADMIN MANAGEMENT');
      console.log('===================================');
      console.log('1. Create new admin');
      console.log('2. List existing admins');
      console.log('3. Update admin role/status');
      console.log('4. Reset admin password');
      console.log('5. Exit');

      const choice = await question('\nSelect option (1-5): ');

      switch (choice) {
        case '1':
          await createAdmin();
          break;
        case '2':
          await listAdmins();
          break;
        case '3':
          await updateAdmin();
          break;
        case '4':
          await resetPassword();
          break;
        case '5':
          console.log('\nGoodbye! 👋');
          process.exit(0);
        default:
          console.log('\n❌ Invalid option. Please try again.');
      }

      await question('\nPress Enter to continue...');
      console.clear();

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      await question('\nPress Enter to continue...');
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Skillzy Arena - Admin Management Script

Usage: node scripts/create-admin.js [options]

Options:
  --help, -h         Show help
  --create           Create admin non-interactively
  --list             List all admins
  --username <name>  Username for non-interactive creation
  --role <role>      Role for non-interactive creation
  --password <pass>  Password for non-interactive creation

Interactive Mode:
  node scripts/create-admin.js

Non-interactive Examples:
  node scripts/create-admin.js --create --username admin1 --role admin --password SecurePass123!
  node scripts/create-admin.js --list
    `);
    process.exit(0);
  }

  if (args.includes('--list')) {
    listAdmins().then(() => {
      rl.close();
      process.exit(0);
    }).catch(error => {
      console.error('❌ Error:', error.message);
      rl.close();
      process.exit(1);
    });
    return;
  }

  if (args.includes('--create')) {
    const usernameIndex = args.indexOf('--username');
    const roleIndex = args.indexOf('--role');
    const passwordIndex = args.indexOf('--password');

    if (usernameIndex === -1 || roleIndex === -1 || passwordIndex === -1) {
      console.error('❌ Non-interactive creation requires --username, --role, and --password');
      process.exit(1);
    }

    const username = args[usernameIndex + 1];
    const role = args[roleIndex + 1];
    const password = args[passwordIndex + 1];

    if (!username || !role || !password) {
      console.error('❌ Missing required parameters');
      process.exit(1);
    }

    if (!ADMIN_CONFIG.roles.includes(role)) {
      console.error('❌ Invalid role. Available roles:', ADMIN_CONFIG.roles.join(', '));
      process.exit(1);
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      console.error('❌ Password does not meet requirements:');
      validation.messages.forEach(msg => console.error(`- ${msg}`));
      process.exit(1);
    }

    // Non-interactive admin creation
    (async () => {
      try {
        const existingAdmins = await loadAdmins();
        
        if (existingAdmins.some(admin => admin.username === username)) {
          throw new Error('Admin with this username already exists');
        }

        const adminData = generateAdminCredentials(username, role);
        adminData.passwordHash = await hashPassword(password);

        existingAdmins.push(adminData);
        await saveAdmins(existingAdmins);

        console.log('✅ Admin created successfully!');
        console.log(`Admin ID: ${adminData.adminId}`);
        console.log(`API Key: ${adminData.apiKey}`);

        rl.close();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error.message);
        rl.close();
        process.exit(1);
      }
    })();

    return;
  }

  // Interactive mode
  showMenu().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    rl.close();
    process.exit(1);
  });
}