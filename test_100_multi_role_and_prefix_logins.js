require('dotenv').config();
const axios = require('axios');
const pool = require('./src/config/db');
const authService = require('./src/services/authService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Concurrency runner to execute async tasks in parallel with a concurrency pool
 */
async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function fetchOtpWithRetry(userId, maxAttempts = 3, delayMs = 400) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delayMs);
    const [rows] = await pool.query('SELECT otp_code FROM users WHERE id = ?', [userId]);
    if (rows[0]?.otp_code) {
      return rows[0].otp_code;
    }
  }
  return null;
}

async function runComprehensiveAuthAndPrefixTests() {
  console.log('================================================================================');
  console.log('🚀 QATARAT REFACTORED AUTH SUITE: 100+ MULTI-ROLE & ALL "00" PREFIX LOGINS');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // PART 1: ALL DATABASE USERS WITH '00' PREFIX PHONE NUMBERS (LIVE LOGIN)
  // --------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('▶️ PART 1: ALL DATABASE "00" PREFIXED NUMBERS LIVE LOGIN AUDIT');
  console.log('--------------------------------------------------------------------------------');

  const [prefixedUsers] = await pool.query(`
    SELECT id, name, phone_number, country_code, mobile_number, role
    FROM users
    WHERE deleted_at IS NULL 
      AND phone_number REGEXP '^00[0-9]+$'
      AND country_code IS NOT NULL 
      AND mobile_number IS NOT NULL
    ORDER BY id ASC
  `);

  console.log(`📋 Found ${prefixedUsers.length} active users with legacy "00" prefix in phone_number.`);
  console.log(`⚡ Testing live login using ONLY countryCode and mobileNumber (as per refactored update)...\n`);

  const prefixResults = [];
  let prefixSuccess = 0;
  let prefixFailed = 0;

  // Process prefix logins with controlled concurrency (5 workers)
  const prefixTask = async (user, index) => {
    const cc = user.country_code;
    const mn = user.mobile_number;
    const originalPhone = user.phone_number;

    try {
      // 1. Send OTP
      await authService.sendWhatsAppOtp({
        countryCode: cc,
        mobileNumber: mn,
        role: 'user',
        sendNew: true
      });

      // 2. Fetch OTP from DB with retry
      const otpCode = await fetchOtpWithRetry(user.id);
      if (!otpCode) {
        throw new Error(`OTP code not found in DB for user ${user.id}`);
      }

      // 3. Login using countryCode + mobileNumber + token
      const loginRes = await authService.verifyOtpAndLogin({
        countryCode: cc,
        mobileNumber: mn,
        token: otpCode,
        sendNew: true
      });

      const isSuccess = loginRes.status === 200 && !!loginRes.accessToken;
      if (isSuccess) {
        prefixSuccess++;
        prefixResults.push({
          index: index + 1,
          userId: user.id,
          originalPhone,
          countryCode: cc,
          mobileNumber: mn,
          role: loginRes.role || 'user',
          status: 'SUCCESS',
          hasJwtToken: true,
          error: null
        });
      } else {
        prefixFailed++;
        prefixResults.push({
          index: index + 1,
          userId: user.id,
          originalPhone,
          countryCode: cc,
          mobileNumber: mn,
          role: 'user',
          status: 'FAILED',
          hasJwtToken: false,
          error: 'No access token returned'
        });
      }
    } catch (err) {
      prefixFailed++;
      prefixResults.push({
        index: index + 1,
        userId: user.id,
        originalPhone,
        countryCode: cc,
        mobileNumber: mn,
        role: 'user',
        status: 'FAILED',
        hasJwtToken: false,
        error: err.response?.data?.message || err.message
      });
    }

    if ((index + 1) % 25 === 0 || index + 1 === prefixedUsers.length) {
      console.log(`   Progress: [${index + 1}/${prefixedUsers.length}] processed. Success: ${prefixSuccess}, Failed: ${prefixFailed}`);
    }
  };

  await asyncPool(5, prefixedUsers.map((u, i) => ({ user: u, index: i })), item => prefixTask(item.user, item.index));

  console.log(`\n✅ PART 1 COMPLETE: Total Tested: ${prefixedUsers.length} | Success: ${prefixSuccess} | Failed: ${prefixFailed}\n`);

  // --------------------------------------------------------------------------
  // PART 2: 100+ MULTI-ROLE SEPARATE LOGINS (USER, DRIVER, ADMIN)
  // --------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('▶️ PART 2: 100+ ACCOUNTS MULTI-ROLE SEPARATE LOGIN TEST (USER, DRIVER, ADMIN)');
  console.log('--------------------------------------------------------------------------------');

  // Select 100+ active unique accounts
  const [multiRoleCandidates] = await pool.query(`
    SELECT id, name, phone_number, country_code, mobile_number
    FROM users
    WHERE deleted_at IS NULL 
      AND country_code IS NOT NULL 
      AND mobile_number IS NOT NULL
    ORDER BY id ASC
    LIMIT 105
  `);

  console.log(`📋 Selected ${multiRoleCandidates.length} active unique accounts for Multi-Role verification.`);
  console.log(`⚡ Assigning User + Driver + Admin roles in model_has_roles and executing separate logins...\n`);

  // Setup roles for each account
  const ROLE_IDS = { admin: 1, user: 2, driver: 4 };
  for (const account of multiRoleCandidates) {
    for (const [roleName, roleId] of Object.entries(ROLE_IDS)) {
      await pool.query(`
        INSERT IGNORE INTO model_has_roles (role_id, model_type, model_id)
        VALUES (?, 'App\\\\Models\\\\User', ?)
      `, [roleId, account.id]);
    }
  }

  const multiRoleResults = [];
  let multiRoleSuccess = 0;
  let multiRoleFailed = 0;

  // Process multi-role accounts with controlled concurrency (4 workers)
  const multiRoleTask = async (account, index) => {
    const cc = account.country_code;
    const mn = account.mobile_number;

    const accountReport = {
      index: index + 1,
      userId: account.id,
      phone: `+${cc}${mn}`,
      userLogin: false,
      driverLogin: false,
      adminLogin: false,
      overallStatus: 'FAILED',
      errors: []
    };

    // Test 1: User Role Login
    try {
      await authService.sendWhatsAppOtp({ countryCode: cc, mobileNumber: mn, role: 'user', sendNew: true });
      const otp = await fetchOtpWithRetry(account.id);
      if (!otp) throw new Error('User role OTP not generated');

      const loginRes = await authService.verifyOtpAndLogin({ countryCode: cc, mobileNumber: mn, token: otp });
      if (loginRes.status === 200 && !!loginRes.accessToken) {
        accountReport.userLogin = true;
      }
    } catch (e) {
      accountReport.errors.push(`User: ${e.response?.data?.message || e.message}`);
    }

    // Test 2: Driver Role Login
    try {
      await authService.sendWhatsAppOtp({ countryCode: cc, mobileNumber: mn, role: 'driver', sendNew: true });
      const otp = await fetchOtpWithRetry(account.id);
      if (!otp) throw new Error('Driver role OTP not generated');

      const loginRes = await authService.verifyOtpAndLogin({ countryCode: cc, mobileNumber: mn, token: otp });
      if (loginRes.status === 200 && !!loginRes.accessToken) {
        accountReport.driverLogin = true;
      }
    } catch (e) {
      accountReport.errors.push(`Driver: ${e.response?.data?.message || e.message}`);
    }

    // Test 3: Admin Role Login
    try {
      await authService.sendWhatsAppOtp({ countryCode: cc, mobileNumber: mn, role: 'admin', sendNew: true });
      const otp = await fetchOtpWithRetry(account.id);
      if (!otp) throw new Error('Admin role OTP not generated');

      const loginRes = await authService.verifyOtpAndLogin({ countryCode: cc, mobileNumber: mn, token: otp });
      if (loginRes.status === 200 && !!loginRes.accessToken) {
        accountReport.adminLogin = true;
      }
    } catch (e) {
      accountReport.errors.push(`Admin: ${e.response?.data?.message || e.message}`);
    }

    if (accountReport.userLogin && accountReport.driverLogin && accountReport.adminLogin) {
      accountReport.overallStatus = 'SUCCESS';
      multiRoleSuccess++;
    } else {
      multiRoleFailed++;
    }

    multiRoleResults.push(accountReport);

    if ((index + 1) % 20 === 0 || index + 1 === multiRoleCandidates.length) {
      console.log(`   Progress: [${index + 1}/${multiRoleCandidates.length}] accounts verified. Complete (User+Driver+Admin): ${multiRoleSuccess}, Failed: ${multiRoleFailed}`);
    }
  };

  await asyncPool(4, multiRoleCandidates.map((a, i) => ({ account: a, index: i })), item => multiRoleTask(item.account, item.index));

  console.log(`\n✅ PART 2 COMPLETE: Total Accounts Tested: ${multiRoleCandidates.length} | All 3 Roles Succeeded: ${multiRoleSuccess} | Failed: ${multiRoleFailed}\n`);

  // --------------------------------------------------------------------------
  // FINAL CONSOLIDATED SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('📊 CONSOLIDATED TEST SUMMARY & LIVE VERIFICATION REPORT');
  console.log('================================================================================');

  console.log('\n--- SAMPLE RESULTS: ALL DATABASE "00" PREFIX NUMBERS (First 10) ---');
  console.table(prefixResults.slice(0, 10).map(r => ({
    '#': r.index,
    'User ID': r.userId,
    'Original Phone': r.originalPhone,
    'Country Code': `+${r.countryCode}`,
    'Mobile Number': r.mobileNumber,
    'Role': r.role,
    'Status': r.status,
    'JWT Received': r.hasJwtToken ? '✅ YES' : '❌ NO'
  })));

  console.log('\n--- SAMPLE RESULTS: 100+ MULTI-ROLE COEXISTENCE LOGINS (First 10) ---');
  console.table(multiRoleResults.slice(0, 10).map(r => ({
    '#': r.index,
    'User ID': r.userId,
    'Phone': r.phone,
    'User Role Login': r.userLogin ? '✅ PASS' : '❌ FAIL',
    'Driver Role Login': r.driverLogin ? '✅ PASS' : '❌ FAIL',
    'Admin Role Login': r.adminLogin ? '✅ PASS' : '❌ FAIL',
    'Overall': r.overallStatus === 'SUCCESS' ? '✅ ALL ROLES' : '❌ PARTIAL'
  })));

  console.log('\n================================================================================');
  console.log('🏁 FINAL AUDIT SCORECARD');
  console.log('================================================================================');
  console.log(`1. Total "00" Prefixed Numbers Audited in DB : ${prefixedUsers.length}`);
  console.log(`   - Successful Logins via CountryCode+Mobile: ${prefixSuccess} (${((prefixSuccess/prefixedUsers.length)*100).toFixed(1)}%)`);
  console.log(`   - Failed Logins                           : ${prefixFailed}`);
  console.log(`2. Total Multi-Role Accounts Tested (100+)   : ${multiRoleCandidates.length}`);
  console.log(`   - Total Separate Role Logins Executed     : ${multiRoleCandidates.length * 3}`);
  console.log(`   - Accounts Passing All Roles (User+Driver+Admin): ${multiRoleSuccess} (${((multiRoleSuccess/multiRoleCandidates.length)*100).toFixed(1)}%)`);
  console.log(`   - Accounts with Issues                   : ${multiRoleFailed}`);
  console.log('================================================================================\n');

  await pool.end();
  const overallSuccess = prefixFailed === 0 && multiRoleFailed === 0;
  return overallSuccess;
}

if (require.main === module) {
  runComprehensiveAuthAndPrefixTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runComprehensiveAuthAndPrefixTests;
