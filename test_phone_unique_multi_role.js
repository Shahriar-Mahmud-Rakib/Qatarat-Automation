require('dotenv').config();
const authService = require('./src/services/authService');
const pool = require('./src/config/db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPhoneUniqueAndMultiRoleTests() {
  console.log('================================================================================');
  console.log('🧪 QATARAT REFACTORED AUTH SUITE: UNIQUE PHONE & MULTI-ROLE VALIDATION');
  console.log('================================================================================\n');

  const testPhone = process.env.ADMIN_PHONE || '8801772173075';
  const parsed = authService.parsePhone(testPhone);
  console.log(`📱 Test Target Phone: ${testPhone}`);
  console.log(`📌 Parsed: CountryCode = +${parsed.countryCode} | MobileNumber = ${parsed.mobileNumber}\n`);

  const results = [];

  // --------------------------------------------------------------------------
  // TEST 1: Phone Uniqueness Verification in Database
  // --------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('▶️ TEST 1: Database Phone Uniqueness & Deduplication Audit');
  console.log('--------------------------------------------------------------------------------');
  try {
    const uniqueness = await authService.verifyPhoneUniqueness(parsed.countryCode, parsed.mobileNumber);
    console.log(`   Active accounts for +${parsed.countryCode}${parsed.mobileNumber}: ${uniqueness.activeCount}`);
    console.log(`   Merged/soft-deleted accounts: ${uniqueness.mergedOrDeletedCount}`);

    const pass = uniqueness.activeCount === 1;
    console.log(`   Result: ${pass ? '✅ PASSED — Strictly 1 Active Account Exists' : '❌ FAILED'}`);
    results.push({
      test: 'Database Phone Uniqueness',
      status: pass ? 'PASSED' : 'FAILED',
      details: `Active: ${uniqueness.activeCount}, Merged/Archived: ${uniqueness.mergedOrDeletedCount}`
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'Database Phone Uniqueness', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Role Assignment on Same Phone Number (User, Driver, Admin)
  // --------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('▶️ TEST 2: Multi-Role Capability (Same Phone as User, Driver, and Admin)');
  console.log('--------------------------------------------------------------------------------');
  try {
    const userOtp = await authService.getOtpFromDb(parsed.countryCode, parsed.mobileNumber);
    if (!userOtp) throw new Error('Active user not found in database');

    console.log(`   User ID: ${userOtp.userId} (${userOtp.name})`);
    console.log(`   Current Primary Role: ${userOtp.primaryRole}`);
    console.log(`   Initial Roles in model_has_roles: ${userOtp.assignedRoles.join(', ')}`);

    // Ensure all 3 roles are assigned to this single user
    console.log('   Assigning / Verifying USER role...');
    await authService.ensureUserRole(userOtp.userId, 'user');
    console.log('   Assigning / Verifying DRIVER role...');
    await authService.ensureUserRole(userOtp.userId, 'driver');
    console.log('   Assigning / Verifying ADMIN role...');
    await authService.ensureUserRole(userOtp.userId, 'admin');

    const updatedUser = await authService.getOtpFromDb(parsed.countryCode, parsed.mobileNumber);
    console.log(`   Final Assigned Roles: ${updatedUser.assignedRoles.join(', ').toUpperCase()}`);

    const hasUser = updatedUser.assignedRoles.includes('user');
    const hasDriver = updatedUser.assignedRoles.includes('driver');
    const hasAdmin = updatedUser.assignedRoles.includes('admin');
    const allRolesPass = hasUser && hasDriver && hasAdmin;

    console.log(`   Roles Validation: User: ${hasUser ? '✅' : '❌'}, Driver: ${hasDriver ? '✅' : '❌'}, Admin: ${hasAdmin ? '✅' : '❌'}`);
    console.log(`   Result: ${allRolesPass ? '✅ PASSED — Same Phone Holds User + Driver + Admin' : '❌ FAILED'}`);

    results.push({
      test: 'Multi-Role Coexistence',
      status: allRolesPass ? 'PASSED' : 'FAILED',
      details: updatedUser.assignedRoles.join(', ')
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'Multi-Role Coexistence', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // TEST 3: WhatsApp OTP Dispatch for User Role
  // --------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('▶️ TEST 3: WhatsApp OTP Dispatch for USER Role');
  console.log('--------------------------------------------------------------------------------');
  let userOtpCode = null;
  try {
    const otpRes = await authService.sendWhatsAppOtp({
      countryCode: parsed.countryCode,
      mobileNumber: parsed.mobileNumber,
      role: 'user',
      sendNew: true
    });
    console.log(`   API Response Status: ${otpRes.status} (No Content / Success)`);

    await sleep(1000);
    const dbOtp = await authService.getOtpFromDb(parsed.countryCode, parsed.mobileNumber);
    userOtpCode = dbOtp?.otpCode;
    console.log(`   Retrieved OTP from DB: ${userOtpCode}`);

    const pass = (otpRes.status === 200 || otpRes.status === 204) && !!userOtpCode;
    console.log(`   Result: ${pass ? '✅ PASSED — OTP Dispatched and Saved in DB' : '❌ FAILED'}`);

    results.push({
      test: 'OTP Dispatch (User Role)',
      status: pass ? 'PASSED' : 'FAILED',
      details: `HTTP ${otpRes.status}, OTP: ${userOtpCode}`
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'OTP Dispatch (User Role)', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // TEST 4: OTP Verification & Login for USER Role
  // --------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('▶️ TEST 4: OTP Verification & JWT Login (USER Role)');
  console.log('--------------------------------------------------------------------------------');
  try {
    if (!userOtpCode) throw new Error('No OTP code available from previous step');

    const loginRes = await authService.verifyOtpAndLogin({
      countryCode: parsed.countryCode,
      mobileNumber: parsed.mobileNumber,
      token: userOtpCode,
      sendNew: true
    });

    console.log(`   Logged in User ID: ${loginRes.userId}`);
    console.log(`   User Name: ${loginRes.userName}`);
    console.log(`   Role in JWT Response: ${loginRes.role}`);
    console.log(`   Bearer Access Token: ${loginRes.accessToken ? loginRes.accessToken.slice(0, 30) + '...' : 'NONE'}`);

    const pass = loginRes.status === 200 && !!loginRes.accessToken;
    console.log(`   Result: ${pass ? '✅ PASSED — User Authenticated Successfully' : '❌ FAILED'}`);

    results.push({
      test: 'OTP Login Verification (User)',
      status: pass ? 'PASSED' : 'FAILED',
      details: `Role: ${loginRes.role}, Token: ${!!loginRes.accessToken}`
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'OTP Login Verification (User)', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // TEST 5: WhatsApp OTP Dispatch for DRIVER Role
  // --------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('▶️ TEST 5: WhatsApp OTP Dispatch for DRIVER Role');
  console.log('--------------------------------------------------------------------------------');
  try {
    const driverOtpRes = await authService.sendWhatsAppOtp({
      countryCode: parsed.countryCode,
      mobileNumber: parsed.mobileNumber,
      role: 'driver',
      sendNew: true
    });
    console.log(`   Driver OTP API Response Status: ${driverOtpRes.status}`);

    const pass = driverOtpRes.status === 200 || driverOtpRes.status === 204;
    console.log(`   Result: ${pass ? '✅ PASSED — Driver OTP Dispatched Successfully' : '❌ FAILED'}`);

    results.push({
      test: 'OTP Dispatch (Driver Role)',
      status: pass ? 'PASSED' : 'FAILED',
      details: `HTTP ${driverOtpRes.status}`
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'OTP Dispatch (Driver Role)', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // TEST 6: WhatsApp OTP Dispatch for ADMIN Role
  // --------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('▶️ TEST 6: WhatsApp OTP Dispatch for ADMIN Role');
  console.log('--------------------------------------------------------------------------------');
  try {
    const adminOtpRes = await authService.sendWhatsAppOtp({
      countryCode: parsed.countryCode,
      mobileNumber: parsed.mobileNumber,
      role: 'admin',
      sendNew: true
    });
    console.log(`   Admin OTP API Response Status: ${adminOtpRes.status}`);

    const pass = adminOtpRes.status === 200 || adminOtpRes.status === 204;
    console.log(`   Result: ${pass ? '✅ PASSED — Admin OTP Dispatched Successfully' : '❌ FAILED'}`);

    results.push({
      test: 'OTP Dispatch (Admin Role)',
      status: pass ? 'PASSED' : 'FAILED',
      details: `HTTP ${adminOtpRes.status}`
    });
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    results.push({ test: 'OTP Dispatch (Admin Role)', status: 'FAILED', details: err.message });
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('📊 AUTH & MULTI-ROLE TEST RESULTS SUMMARY');
  console.log('================================================================================');
  console.table(results);

  const allPassed = results.every(r => r.status === 'PASSED');
  console.log(`\n🎉 FINAL OUTCOME: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}\n`);

  await pool.end();
  return allPassed;
}

if (require.main === module) {
  runPhoneUniqueAndMultiRoleTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = runPhoneUniqueAndMultiRoleTests;
