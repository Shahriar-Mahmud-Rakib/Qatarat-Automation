require('dotenv').config();
const authService = require('./src/services/authService');
const pool = require('./src/config/db');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const inputPhone = process.argv[2];

if (!inputPhone || inputPhone === 'help' || inputPhone === '--help') {
  console.log(`
================================================================================
📱 QATARAT INSTANT OTP FETCHER CLI (REFACTORED UNIQUE PHONE & MULTI-ROLE)
================================================================================

Usage:
  node index.js otp <PHONE_NUMBER>
  node get_otp.js <PHONE_NUMBER>

Examples:
  node index.js otp 01772173075
  node index.js otp 8801772173075
  node index.js otp 008801772173075
  node index.js otp 0500000000
  node index.js otp 966500000000

Options:
  --watch    Wait and poll live for incoming OTP (up to 30 seconds)
================================================================================
`);
  process.exit(0);
}

const parsed = authService.parsePhone(inputPhone);

async function fetchOtp() {
  console.log('================================================================================');
  console.log(`🔍 FETCHING OTP FOR PHONE: ${inputPhone}`);
  console.log(`📌 Country Code: +${parsed.countryCode} | Mobile Number: ${parsed.mobileNumber} (Indexed Lookup)`);
  console.log('================================================================================\n');

  const startTime = Date.now();
  const isWatch = process.argv.includes('--watch');
  const maxWaitMs = isWatch ? 30000 : 5000;

  while (Date.now() - startTime <= maxWaitMs) {
    const userOtp = await authService.getOtpFromDb(parsed.countryCode, parsed.mobileNumber);

    if (userOtp && userOtp.otpCode) {
      console.log('┌─────────────────────────────────────────────────────────────────┐');
      console.log(`│  🔑 YOUR OTP CODE IS:       \x1b[1m\x1b[32m${userOtp.otpCode.padEnd(33)}\x1b[0m│`);
      console.log('├─────────────────────────────────────────────────────────────────┤');
      console.log(`│  👤 Active User ID:         ${String(userOtp.userId).padEnd(33)}│`);
      console.log(`│  🏷️  User Name:              ${String(userOtp.name || 'N/A').padEnd(33)}│`);
      console.log(`│  🛡️  Assigned Roles:         ${userOtp.assignedRoles.join(', ').toUpperCase().padEnd(33)}│`);
      console.log(`│  📞 Registered Phone:       ${String(userOtp.phoneNumber || `${parsed.countryCode}${parsed.mobileNumber}`).padEnd(33)}│`);
      console.log(`│  🕒 Last Updated:           ${String(userOtp.updatedAt ? new Date(userOtp.updatedAt).toLocaleString() : 'Recent').padEnd(33)}│`);
      console.log('└─────────────────────────────────────────────────────────────────┘\n');

      // Check phone uniqueness
      const uniqueness = await authService.verifyPhoneUniqueness(parsed.countryCode, parsed.mobileNumber);
      if (uniqueness.isUnique) {
        console.log(`✅ Phone Uniqueness Verified: Strictly 1 Active User Account found in database.`);
      } else {
        console.log(`⚠️ Warning: Found ${uniqueness.activeCount} active user accounts with this phone.`);
      }

      if (uniqueness.mergedOrDeletedCount > 0) {
        console.log(`ℹ️ Clean Architecture: ${uniqueness.mergedOrDeletedCount} legacy duplicate account(s) merged/soft-deleted.`);
      }

      await pool.end();
      process.exit(0);
    }

    if (isWatch) {
      process.stdout.write('⏳ Waiting for incoming OTP... \r');
      await sleep(1500);
    } else {
      break;
    }
  }

  console.log(`❌ No active OTP found for phone ${inputPhone}.`);
  console.log(`👉 Tip: If you just requested OTP in the app, run:`);
  console.log(`   node index.js otp ${inputPhone} --watch\n`);

  await pool.end();
  process.exit(1);
}

fetchOtp().catch(err => {
  console.error('❌ Database error:', err.message);
  pool.end();
  process.exit(1);
});
