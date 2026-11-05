#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const command = (process.argv[2] || 'help').toLowerCase();
const restArgs = process.argv.slice(3);

function runScript(scriptRelativePath, args = []) {
  const fullPath = path.resolve(__dirname, scriptRelativePath);
  const child = spawn(process.execPath, [fullPath, ...args], {
    stdio: 'inherit',
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
  });
  child.on('exit', code => process.exit(code || 0));
}

switch (command) {
  // ============================================================================
  // 1. PAYMENT MODEL (Full user lifecycle: Cart -> Gift -> Live Gateway -> Admin -> Close Dist -> WebApp)
  // ============================================================================
  case 'payment':
  case 'payment-test':
  case 'payments':
  case 'pay':
    console.log('🚀 Running Qatarat Payment Model (Live Browser)...\n');
    runScript('./src/models/paymentModel.js', restArgs);
    break;

  // ============================================================================
  // 2. PHONE / AUTH MODEL (All phone refactoring, uniqueness, multi-role, 00 prefixes, OTP)
  // ============================================================================
  case 'phone':
  case 'phone-number':
  case 'phonenumber':
  case 'auth':
  case 'test-auth':
  case 'test-phone':
    console.log('🚀 Running Qatarat Phone Refactor Model...\n');
    runScript('./src/models/phoneModel.js', restArgs);
    break;

  // ============================================================================
  // 3. CLOSE DISTRIBUTION MODEL (5-Point predicate audit vs Driver delivery)
  // ============================================================================
  case 'close-dist':
  case 'close-distribution':
  case 'closedist':
  case 'cd':
    console.log('🚀 Running Qatarat Close Distribution Model...\n');
    runScript('./src/models/closeDistributionModel.js', restArgs);
    break;

  // ============================================================================
  // 4. SUBSCRIPTION MODEL (Deduplication, Next Generate Date & Worker API)
  // ============================================================================
  case 'subscription':
  case 'subscriptions':
  case 'subs':
  case 'sub':
    console.log('🚀 Running Qatarat Subscription Model...\n');
    runScript('./src/models/subscriptionModel.js', restArgs);
    break;

  // ============================================================================
  // 5. FULL / MASTER SUITE (Executes all 4 models sequentially)
  // ============================================================================
  case 'full':
  case 'all':
  case 'master':
  case 'full-test':
  case 'test-all':
    console.log('🚀 Running Full Qatarat Master Suite (All Models Sequentially)...\n');
    runScript('./src/models/allModel.js', restArgs);
    break;

  // ============================================================================
  // UTILITY: OTP Helper
  // ============================================================================
  case 'otp':
  case 'get-otp':
    runScript('./get_otp.js', restArgs);
    break;

  // ============================================================================
  // EXTENDED QA SUITES & BACKWARD COMPATIBILITY
  // ============================================================================
  case 'orders':
  case 'order':
    runScript('./run_orders.js', restArgs);
    break;

  case 'test-100':
  case '100':
  case 'multi-role-100':
  case 'prefix-100':
    runScript('./test_100_multi_role_and_prefix_logins.js', restArgs);
    break;

  case 'qatar-759':
  case '759':
  case 'compliance':
  case 'phone-audit':
    runScript('./test_qatar_759_compliance.js', restArgs);
    break;

  case 'qatar-796':
  case '796':
  case 'webapp-qa':
  case 'admin-qa':
    runScript('./test_qatar_796_compliance.js', restArgs);
    break;

  case 'close-dist-flow':
  case 'close-distribution-flow':
  case 'close-flow':
  case 'live-close':
    runScript('./run_close_distribution_live_workflow.js', restArgs);
    break;

  case 'admin-ui':
  case 'admin-complete':
  case 'admin-e2e':
  case 'dashboard-ui':
    runScript('./test_admin_ui_and_matrix_complete.js', restArgs);
    break;

  case 'admin-matrix':
  case 'matrix':
  case 'admin-dashboard':
  case 'dashboard-qa':
    runScript('./test_admin_dashboard_full_matrix.js', restArgs);
    break;

  case 'gateway-switch':
  case 'switch':
    runScript('./test_gateway_switch_scenarios.js', restArgs);
    break;

  case 'rule5':
    runScript('./test_rule5_audit.js', restArgs);
    break;

  case 'pdf-test':
  case 'pdf':
    runScript('./test_pdf_investigation_flow.js', restArgs);
    break;

  case 'templates':
  case 'template':
    runScript('./run_templates.js', restArgs);
    break;

  case 'verify':
    runScript('./test_close_distribution.js', restArgs);
    break;

  case 'report':
  case 'html':
  case 'html-report':
    runScript('./generate_report_html.js', restArgs);
    break;

  // ============================================================================
  // DEFAULT / HELP MENU
  // ============================================================================
  default:
    console.log(`
================================================================================================
🌟 QATARAT AUTOMATION — MODULAR ARCHITECTURE CLI
================================================================================================

🎯 1. PAYMENT MODEL (Real User Journey):
   Runs the end-to-end checkout & payment lifecycle on real staging browser:
   (Login -> DB OTP -> Clear Cart -> Add Item -> Add Gift -> MyFatoorah Live -> Admin Search Wait -> Close Dist -> Web App)
   👉 node index.js payment
   👉 npm run test:payment

🎯 2. PHONE NUMBER MODEL (Refactor & Schema Suite):
   Tests all phone number refactoring wherever and however it is used in Qatarat:
   (Normalization, DB Uniqueness, Multi-Role User/Driver/Admin, OTP dispatch, Legacy 00 Prefix Audit)
   👉 node index.js phone
   👉 npm run test:phone

🎯 3. CLOSE DISTRIBUTION MODEL (5-Point Audit):
   Audits the 5 predicate business rules (need_delivery = 0, driver_id NULL, one-time, paid, pending)
   👉 node index.js close-dist
   👉 npm run test:close-dist

🎯 4. SUBSCRIPTION MODEL (Deduplication & Worker):
   Tests unique active constraints, next_generate_date scheduling, and worker auto-generation
   👉 node index.js subscription
   👉 npm run test:subscription

🎯 5. FULL MASTER SUITE (All Models Sequentially):
   Executes all 4 models in sequence and produces a unified summary report:
   👉 node index.js full
   👉 npm run test:all

🔧 UTILITY:
   👉 node index.js otp <phone>   (Fetch instant WhatsApp OTP from DB)

================================================================================================
`);
    break;
}
