require('dotenv').config();
const { spawn } = require('child_process');

function runSuite(scriptPath) {
  return new Promise((resolve) => {
    console.log(`\n================================================================================`);
    console.log(`🚀 LAUNCHING SUITE: ${scriptPath}`);
    console.log(`================================================================================\n`);

    const child = spawn('node', [scriptPath], { stdio: 'inherit' });
    child.on('exit', code => {
      resolve({ script: scriptPath, passed: code === 0, code });
    });
  });
}

async function runAll() {
  console.log(`
================================================================================
🌟 QATARAT MASTER AUDIT SUITE: PHONE UNIQUENESS, PAYMENT & SUBSCRIPTION REFACTOR
================================================================================
Timestamp: ${new Date().toISOString()}
`);

  const suites = [
    './test_phone_unique_multi_role.js',
    './test_refactored_payment_system.js',
    './test_refactored_subscription_system.js'
  ];

  const results = [];
  for (const s of suites) {
    const res = await runSuite(s);
    results.push(res);
  }

  console.log(`
================================================================================
🏁 MASTER TEST SUITE EXECUTION SUMMARY
================================================================================`);
  console.table(results.map(r => ({
    'Test Suite': r.script,
    'Status': r.passed ? '✅ PASSED' : '❌ FAILED',
    'Exit Code': r.code
  })));

  const allPassed = results.every(r => r.passed);
  console.log(`\n🏆 OVERALL SYSTEM STATUS: ${allPassed ? 'ALL REFACTORED MODULES 100% OPERATIONAL & VERIFIED ✅' : 'SOME SUITES FAILED ❌'}\n`);

  process.exit(allPassed ? 0 : 1);
}

runAll();
