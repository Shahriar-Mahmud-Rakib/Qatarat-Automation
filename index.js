const { spawn } = require('child_process');

const command = process.argv[2] || 'help';
const restArgs = process.argv.slice(3);

function runScript(scriptPath, args = []) {
  const child = spawn('node', [scriptPath, ...args], { stdio: 'inherit' });
  child.on('exit', code => process.exit(code || 0));
}

switch (command.toLowerCase()) {
  case 'orders':
  case 'order':
    // Examples: node index.js orders 50 single
    //           node index.js orders 50 multi
    runScript('./run_orders.js', restArgs.length > 0 ? restArgs : ['5', 'single']);
    break;

  case 'subscription':
  case 'subs':
  case 'sub':
    // Examples: node index.js subs 50
    //           node index.js subs single 9216
    runScript('./run_subscription.js', restArgs.length > 0 ? restArgs : ['5']);
    break;

  case 'otp':
  case 'get-otp':
  case 'code':
    // Example: node index.js otp 01772173075
    //          node index.js otp 8801772173075 --watch
    runScript('./get_otp.js', restArgs);
    break;

  case 'gateway':
  case 'gateway-switch':
  case 'switch':
    // Payment Gateway Switching (MyFatoorah <-> PayTabs Abandon & Pay)
    runScript('./test_gateway_switch_scenarios.js');
    break;

  case 'rule5':
  case 'rule05':
  case 'status':
    // Rule 05 Audit (order_detail_status IN 1, 6 vs 4)
    runScript('./test_rule5_audit.js');
    break;

  case 'pdf':
  case 'pdf-test':
  case 'investigation':
    // PDF Report 5-point live investigation test
    runScript('./test_pdf_investigation_flow.js');
    break;

  case 'template':
  case 'templates':
  case 'preset':
    // Examples: node index.js template same-user-50-close-dist
    //           node index.js template multi-user-50-close-dist
    runScript('./run_template.js', restArgs);
    break;

  case 'verify':
    runScript('./test_close_distribution.js', restArgs);
    break;

  case 'auth':
  case 'test-auth':
  case 'phone':
    // Refactored Phone Uniqueness & Multi-Role Test Suite
    runScript('./test_phone_unique_multi_role.js');
    break;

  case 'payment':
  case 'test-payment':
  case 'payments':
    // Refactored Payment System & Outbox Test Suite
    runScript('./test_refactored_payment_system.js');
    break;

  case 'subscription-refactor':
  case 'test-subscription':
  case 'subs-refactor':
    // Refactored Subscription System & Unique Active Flag Suite
    runScript('./test_refactored_subscription_system.js');
    break;

  case 'all':
  case 'test-all':
  case 'master':
    // Master Test Suite executing all refactored modules
    runScript('./test_all_refactored_modules.js');
    break;

  case 'test-100':
  case '100':
  case 'multi-role-100':
  case 'prefix-100':
    // 100+ Multi-Role separate logins and all database '00' prefix live login test
    runScript('./test_100_multi_role_and_prefix_logins.js');
    break;

  case 'report':
  case 'html':
  case 'html-report':
    // Generate interactive HTML report dashboard
    runScript('./generate_report_html.js');
    break;

  default:
    console.log(`
================================================================================
🌟 QATARAT MASTER QA AUTOMATION SUITE — DEDICATED COMMAND CHEAT SHEET
================================================================================

🎯 1. Direct Order Generation (Single vs. Multi-User):
   - Same User (e.g. 50 orders for 1 user):
     👉 node index.js orders 50 single
   - Multi Users (e.g. 50 orders for 50 distinct users):
     👉 node index.js orders 50 multi
   - Any Custom Order Count & Speed:
     👉 node index.js orders 10 single mixed browser

--------------------------------------------------------------------------------

🎯 2. Subscription Worker Testing (Dynamic N Users):
   - Dynamic N Distinct Users Subscriptions:
     👉 node index.js subs 50
   - Single Subscription Test:
     👉 node index.js subs single 9216

--------------------------------------------------------------------------------

🎯 3. Instant User Login OTP Fetcher (App / Web / Admin):
   - Get OTP by phone number:
     👉 node index.js otp 01772173075
     👉 node index.js otp 8801772173075
   - Wait & Live-poll for incoming OTP from app:
     👉 node index.js otp 01772173075 --watch

--------------------------------------------------------------------------------

🎯 4. Payment Gateway Cancel & Switch Test (MyFatoorah ➔ PayTabs / PayTabs ➔ MyFatoorah):
   - Tests abandoning Gateway A and paying via Gateway B on Direct & Subscription orders:
     👉 node index.js gateway-switch

--------------------------------------------------------------------------------

🎯 5. Rule 05 Audit Test (order_detail_status IN 1, 6):
   - Tests status 1 (Direct) vs status 6 (Subscription) vs status 4 (Closed):
     👉 node index.js rule5

--------------------------------------------------------------------------------

🎯 6. PDF 5-Point Live Investigation Test:
   - Tests the exact 5-point database routing logic from the PDF report:
     👉 node index.js pdf-test

--------------------------------------------------------------------------------

🎯 7. Pre-configured Preset Templates:
   - List all available templates:
     👉 node index.js templates
   - Run a template:
     👉 node index.js template same-user-50-close-dist
     👉 node index.js template multi-user-50-close-dist
     👉 node index.js template multi-user-50-subscription

--------------------------------------------------------------------------------

🎯 8. Verify Any Live Order in Database:
   - Check an order by order number:
     👉 node index.js verify 260928334297

================================================================================
`);
    break;
}
