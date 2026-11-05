require('dotenv').config();
const orderService = require('./src/services/orderService');
const pool = require('./src/config/db');

// Parse arguments & flags
const args = process.argv.slice(2);

let count = 5;
let userMode = 'single';      // 'single' | 'multi'
let category = 'close-dist';  // 'close-dist' | 'mixed' | 'set-order'
let executionMode = 'fast';   // 'fast' | 'browser'
let cardType = 'myfatoorah';
let concurrency = 10;

// Positional arguments parser
if (args[0] && !args[0].startsWith('--')) {
  count = parseInt(args[0], 10) || 5;
}
if (args[1] && !args[1].startsWith('--')) {
  userMode = args[1].toLowerCase() === 'multi' ? 'multi' : 'single';
}
if (args[2] && !args[2].startsWith('--')) {
  if (['close-dist', 'mixed', 'set-order'].includes(args[2].toLowerCase())) {
    category = args[2].toLowerCase();
  } else if (['fast', 'browser'].includes(args[2].toLowerCase())) {
    executionMode = args[2].toLowerCase();
  }
}
if (args[3] && !args[3].startsWith('--')) {
  if (['fast', 'browser'].includes(args[3].toLowerCase())) {
    executionMode = args[3].toLowerCase();
  }
}

// Flags parser
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) count = parseInt(args[i + 1], 10);
  if (args[i] === '--user' && args[i + 1]) userMode = args[i + 1].toLowerCase();
  if (args[i] === '--category' && args[i + 1]) category = args[i + 1].toLowerCase();
  if (args[i] === '--mode' && args[i + 1]) executionMode = args[i + 1].toLowerCase();
  if (args[i] === '--card' && args[i + 1]) cardType = args[i + 1].toLowerCase();
  if ((args[i] === '--concurrency' || args[i] === '-c') && args[i + 1]) concurrency = parseInt(args[i + 1], 10);
  if (args[i] === '--browser') executionMode = 'browser';
  if (args[i] === '--multi') userMode = 'multi';
  if (args[i] === '--single') userMode = 'single';
}

// Auto select fast mode for count > 5 unless explicitly specified
if (!args.includes('--browser') && !args.includes('browser') && count > 5) {
  executionMode = 'fast';
}

async function main() {
  try {
    const results = await orderService.runFlexibleOrders({
      count,
      userMode,
      category,
      executionMode,
      cardType,
      concurrency
    });

    console.log('\n================================================================================');
    console.log('📊 EXECUTION SUMMARY & VISIBILITY REPORT');
    console.log('================================================================================');
    
    // Print concise table
    console.table(results.map((r, idx) => ({
      '#': idx + 1,
      'Customer': r.customerName || 'Single User',
      'Phone': r.customerPhone || 'N/A',
      'Order #': r.orderNumber,
      'Suborder ID': r.suborderId || 'N/A',
      'Package / Item': `${r.package_name || 'N/A'} (${r.item_name || 'N/A'})`.slice(0, 32),
      'Cost': `${r.cost} SAR`,
      'Close Dist Table': r.inCloseDistribution ? '✅ VISIBLE' : '❌ MISSING',
      'Diagnostic': r.diagnostic ? r.diagnostic.slice(0, 30) : 'OK'
    })));

    const closeDistCount = results.filter(r => r.inCloseDistribution).length;
    const setOrderCount = results.filter(r => r.inSetOrder).length;
    const failedCount = results.filter(r => !r.inCloseDistribution && !r.inSetOrder).length;

    console.log(`\n🎯 Summary Metrics:`);
    console.log(`   - Total Orders Created: ${results.length}`);
    console.log(`   - Distinct Users:       ${userMode === 'single' ? '1 Single User' : `${results.length} Unique Users`}`);
    console.log(`   - Visible in Close Dist: ${closeDistCount} / ${results.length} (${((closeDistCount / results.length) * 100).toFixed(1)}%) ✅`);
    console.log(`   - In Set Order:         ${setOrderCount}`);
    console.log(`   - Missing / Failed:     ${failedCount}`);
    if (failedCount > 0) {
      console.log(`   - Failed / Excluded:   ${failedCount} order(s) ⚠️`);
    }

  } catch (err) {
    console.error('❌ Execution failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
