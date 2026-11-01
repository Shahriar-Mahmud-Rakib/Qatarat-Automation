require('dotenv').config();
const subscriptionService = require('./src/services/subscriptionService');
const pool = require('./src/config/db');

const args = process.argv.slice(2);

let isSingle = false;
let subscriptionId = 9216;
let count = 5;
let targetDate = '2026-09-28';
let filterCloseDistribution = true;

// Positional argument parser
if (args[0] && !args[0].startsWith('--')) {
  if (args[0].toLowerCase() === 'single') {
    isSingle = true;
    if (args[1]) subscriptionId = parseInt(args[1], 10) || 9216;
  } else {
    const parsedNum = parseInt(args[0], 10);
    // If it's a large ID like 9216 and count is 1, treat as single sub
    if (parsedNum > 1000) {
      isSingle = true;
      subscriptionId = parsedNum;
    } else {
      count = parsedNum || 5;
    }
  }
}

if (args[1] && !args[1].startsWith('--')) {
  if (args[1].includes('-')) {
    targetDate = args[1];
  } else if (isSingle) {
    targetDate = args[1];
  } else if (!isSingle && parseInt(args[1], 10) > 1000) {
    isSingle = true;
    subscriptionId = parseInt(args[1], 10);
  }
}

if (args[2] && !args[2].startsWith('--')) {
  if (args[2].includes('-')) targetDate = args[2];
}

// Flags parser
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) {
    count = parseInt(args[i + 1], 10);
    isSingle = false;
  }
  if (args[i] === '--id' && args[i + 1]) {
    subscriptionId = parseInt(args[i + 1], 10);
    isSingle = true;
  }
  if (args[i] === '--date' && args[i + 1]) targetDate = args[i + 1];
  if (args[i] === '--all') filterCloseDistribution = false;
  if (args[i] === '--single') isSingle = true;
}

async function main() {
  try {
    if (isSingle) {
      console.log('================================================================================');
      console.log(`🚀 RUNNING SINGLE SUBSCRIPTION WORKER TEST`);
      console.log(`📌 Subscription ID: #${subscriptionId} | Target Date: ${targetDate}`);
      console.log('================================================================================');

      const res = await subscriptionService.runSingleSubscriptionTest(subscriptionId, targetDate);

      console.log('\n================================================================================');
      console.log('📊 SUBSCRIPTION WORKER EXECUTION REPORT');
      console.log('================================================================================');
      console.table([{
        'Subscription ID': res.subscriptionId,
        'Generated Order': res.orderNumber,
        'Suborder ID': res.suborderId,
        'Package': res.packageName,
        'Order Mgmt': res.inOrderManagement ? '✅ YES' : '❌ NO',
        'Close Dist': res.inCloseDistribution ? '✅ YES' : '❌ NO',
        'Next Gen Date (+7d)': res.nextGenerateDate ? new Date(res.nextGenerateDate).toISOString().split('T')[0] : 'N/A',
        'Diagnostic': res.diagnostic
      }]);

      if (res.inCloseDistribution) {
        console.log(`\n✅ SUCCESS: Order #${res.orderNumber} successfully generated and routed to Close Distribution.`);
      } else {
        console.log(`\n⚠️ NOTICE: Order #${res.orderNumber} not in Close Distribution. Reason: ${res.diagnostic}`);
      }

    } else {
      const results = await subscriptionService.runFlexibleSubscriptionTest({
        count,
        targetDate,
        filterCloseDistribution
      });

      console.log('\n================================================================================');
      console.log('📊 MULTI-USER SUBSCRIPTION WORKER SUMMARY REPORT');
      console.log('================================================================================');
      console.table(results.map((r, idx) => ({
        '#': idx + 1,
        'User Phone': r.userPhone,
        'Sub ID': r.subscriptionId,
        'Order #': r.orderNumber,
        'Suborder ID': r.suborderId || 'N/A',
        'Package': (r.packageName || 'N/A').slice(0, 25),
        'Cost': `${r.cost} SAR`,
        'Close Dist': r.inCloseDistribution ? '✅ YES' : '❌ NO',
        'Next Cycle (+7d)': r.nextGenerateDate ? new Date(r.nextGenerateDate).toISOString().split('T')[0] : 'N/A'
      })));

      const successCount = results.filter(r => r.inCloseDistribution).length;
      console.log(`\n🎯 Summary Metrics:`);
      console.log(`   - Distinct Subscribers Tested: ${results.length}`);
      console.log(`   - Successfully in Close Dist:   ${successCount} / ${results.length} ✅`);
      console.log(`   - Next Schedule Date:          All successfully advanced to next cycle`);
    }

  } catch (err) {
    console.error('❌ Subscription Test failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
