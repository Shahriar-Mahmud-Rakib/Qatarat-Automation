require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('./src/config/db');
const VerifierService = require('./src/services/verifierService');
const orderService = require('./src/services/orderService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const CATALOG_ITEMS = [
  { name: 'Watering Al-Haram (5 Cartons)', package_name: 'Watering Al-Haram', item_name: '5 Cartons', sale_item_id: 95, home_icon_id: 3, expected_price: 82.5, category: 'close-dist' },
  { name: 'Haram Meal (5 Meals)', package_name: 'Haram Meal', item_name: '5 Meals', sale_item_id: 107, home_icon_id: 3, expected_price: 75.0, category: 'close-dist' },
  { name: 'Watering Al-Haram (10 Cartons)', package_name: 'Watering Al-Haram', item_name: '10 Cartons', sale_item_id: 35, home_icon_id: 3, expected_price: 140.0, category: 'close-dist' },
  { name: 'Haram Meal (10 Meals)', package_name: 'Haram Meal', item_name: '10 Meals', sale_item_id: 47, home_icon_id: 3, expected_price: 150.0, category: 'close-dist' },
  { name: 'Watering Al-Haram (20 Cartons)', package_name: 'Watering Al-Haram', item_name: '20 Cartons', sale_item_id: 36, home_icon_id: 3, expected_price: 255.0, category: 'close-dist' },
  { name: 'Haram Meal (20 Meals)', package_name: 'Haram Meal', item_name: '20 Meals', sale_item_id: 48, home_icon_id: 3, expected_price: 300.0, category: 'close-dist' },
  { name: 'Providing Water (10 Cartons - Driver Delivery)', package_name: 'Providing Water', item_name: '10 Cartons', sale_item_id: 1, home_icon_id: 1, expected_price: 82.5, category: 'set-order' },
  { name: 'Watering Al-Haram (30 Cartons)', package_name: 'Watering Al-Haram', item_name: '30 Cartons', sale_item_id: 37, home_icon_id: 3, expected_price: 370.0, category: 'close-dist' },
  { name: 'Haram Meal (30 Meals)', package_name: 'Haram Meal', item_name: '30 Meals', sale_item_id: 49, home_icon_id: 3, expected_price: 450.0, category: 'close-dist' },
  { name: 'Providing Water (20 Cartons - Driver Delivery)', package_name: 'Providing Water', item_name: '20 Cartons', sale_item_id: 2, home_icon_id: 1, expected_price: 165.0, category: 'set-order' }
];

const TOTAL_ORDERS = 100;
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 15;

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function run100ConcurrentOrdersTest() {
  console.log('================================================================================');
  console.log('🚀 QATARAT 100 INDIVIDUAL USERS CONCURRENT ORDER STRESS TEST');
  console.log('================================================================================');
  console.log(`📊 Target Orders:       ${TOTAL_ORDERS}`);
  console.log(`👤 Distinct Users:      ${TOTAL_ORDERS} unique profiles`);
  console.log(`⚡ Concurrency Pool:    ${CONCURRENCY} parallel workers`);
  console.log(`🕒 Start Time:          ${new Date().toISOString()}`);
  console.log('================================================================================\n');

  const overallStartTime = Date.now();
  const results = new Array(TOTAL_ORDERS);
  const errorLog = [];
  const phaseTimings = {
    auth: [],
    profileUpdate: [],
    addToCart: [],
    getCart: [],
    initiatePayment: [],
    reconcile: [],
    verify: [],
    totalOrder: []
  };

  let currentIndex = 0;
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  const baseApi = process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';

  const worker = async (workerId) => {
    while (currentIndex < TOTAL_ORDERS) {
      const idx = currentIndex++;
      const orderNumLabel = `[Order ${idx + 1}/${TOTAL_ORDERS}]`;
      const catalogItem = CATALOG_ITEMS[idx % CATALOG_ITEMS.length];

      // Unique customer details
      const uniqueMobile = String(171000000 + idx + 1);
      const customer = {
        name: `QA Stress User ${idx + 1}`,
        country_code: '880',
        mobile_number: uniqueMobile,
        phone: `880${uniqueMobile}`,
        email: `qa_stress_${idx + 1}_${Date.now()}@qataratapp.com`
      };

      const record = {
        index: idx + 1,
        workerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        package_name: catalogItem.package_name,
        item_name: catalogItem.item_name,
        category: catalogItem.category,
        expectedCost: catalogItem.expected_price,
        orderNumber: null,
        clientOrderId: null,
        suborderId: null,
        userId: null,
        success: false,
        error: null,
        errorPhase: null,
        durationMs: 0,
        timings: {},
        inOrderManagement: false,
        inCloseDistribution: false,
        inSetOrder: false,
        diagnostic: null
      };

      const orderStart = Date.now();

      try {
        // Phase 1: Create fresh guest session
        const tAuth0 = Date.now();
        const guestRes = await axios.post(`${baseApi}/api/v2/Accounts/AccessGuestUser`, {}, { timeout: 45000 });
        const token = guestRes.data.accessToken;
        const userId = guestRes.data.id;
        record.userId = userId;
        const tAuth = Date.now() - tAuth0;
        record.timings.auth = tAuth;
        phaseTimings.auth.push(tAuth);

        // Phase 2: Update customer profile in DB for this distinct user
        const tProf0 = Date.now();
        await pool.query(
          'UPDATE users SET name = ?, phone_number = ?, country_code = ?, mobile_number = ?, email = ?, updated_at = NOW() WHERE id = ?',
          [customer.name, customer.phone, customer.country_code, customer.mobile_number, customer.email, userId]
        );
        const tProf = Date.now() - tProf0;
        record.timings.profileUpdate = tProf;
        phaseTimings.profileUpdate.push(tProf);

        // Phase 3: Add Item to Cart
        const tCart0 = Date.now();
        await axios.post(`${baseApi}/api/v2/carts/add-new-sale-item`, {
          sale_item_id: catalogItem.sale_item_id,
          quantity: 1,
          home_icon_id: catalogItem.home_icon_id
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 45000
        });
        const tCart = Date.now() - tCart0;
        record.timings.addToCart = tCart;
        phaseTimings.addToCart.push(tCart);

        // Phase 4: Retrieve Cart & Main Order Number
        const tGetCart0 = Date.now();
        const cartRes = await axios.get(`${baseApi}/api/v2/carts/get-my-cart-order`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 45000
        });
        const orderObj = cartRes.data.order;
        record.orderNumber = orderObj.number;
        record.clientOrderId = orderObj.id;
        record.cost = Number(orderObj.cost || catalogItem.expected_price);
        const tGetCart = Date.now() - tGetCart0;
        record.timings.getCart = tGetCart;
        phaseTimings.getCart.push(tGetCart);

        // Phase 5: Initiate Payment on MyFatoorah
        const tPay0 = Date.now();
        const initPayRes = await axios.post(`${baseApi}/api/v2/web-payments/initiate/myfatoorah`, {
          cart_id: record.clientOrderId,
          callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
          errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
          paymentMethodId: 2,
          phoneNumber: customer.phone,
          name: customer.name,
          email: customer.email
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 45000
        });
        const paymentUrl = initPayRes.data.payment_url;
        const tPay = Date.now() - tPay0;
        record.timings.initiatePayment = tPay;
        phaseTimings.initiatePayment.push(tPay);

        // Phase 6: Payment Reconcile & Outbox Event Dispatch
        const tRec0 = Date.now();
        const realDbOrderId = await orderService.ensurePaymentReconciled(record.orderNumber, customer, userId);
        record.clientOrderId = realDbOrderId;
        const tRec = Date.now() - tRec0;
        record.timings.reconcile = tRec;
        phaseTimings.reconcile.push(tRec);

        // Phase 7: Verification across Admin Tables
        const tVer0 = Date.now();
        const visibility = await VerifierService.getOrderVisibility(realDbOrderId);
        const tVer = Date.now() - tVer0;
        record.timings.verify = tVer;
        phaseTimings.verify.push(tVer);

        if (visibility) {
          record.suborderId = visibility.suborderId;
          record.inOrderManagement = visibility.inOrderManagement;
          record.inCloseDistribution = visibility.inCloseDistribution;
          record.inSetOrder = visibility.inSetOrder;
          record.diagnostic = visibility.diagnostic;
        }

        record.success = true;
        record.durationMs = Date.now() - orderStart;
        phaseTimings.totalOrder.push(record.durationMs);

        successCount++;
        completedCount++;

        const distStatus = record.inCloseDistribution ? 'CloseDist ✅' : (record.inSetOrder ? 'SetOrder 🚚' : 'Mgmt ✅');
        console.log(`[W${workerId}] ▶️ ${orderNumLabel} User: ${customer.name} | Order #${record.orderNumber} (ID: ${record.clientOrderId}, Suborder: ${record.suborderId}) | ${distStatus} | Took: ${(record.durationMs / 1000).toFixed(1)}s [Progress: ${completedCount}/${TOTAL_ORDERS}]`);

      } catch (err) {
        failureCount++;
        completedCount++;
        record.success = false;
        record.durationMs = Date.now() - orderStart;
        record.error = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
        
        // Pinpoint which phase failed
        if (!record.userId) record.errorPhase = 'Phase 1: Guest Auth';
        else if (!record.timings.profileUpdate) record.errorPhase = 'Phase 2: DB User Profile';
        else if (!record.timings.addToCart) record.errorPhase = 'Phase 3: Add to Cart';
        else if (!record.orderNumber) record.errorPhase = 'Phase 4: Get Cart Order';
        else if (!record.timings.initiatePayment) record.errorPhase = 'Phase 5: Initiate Payment';
        else if (!record.timings.reconcile) record.errorPhase = 'Phase 6: Reconcile DB';
        else record.errorPhase = 'Phase 7: Verify Admin';

        console.error(`[W${workerId}] ❌ ${orderNumLabel} FAILED at ${record.errorPhase}: ${record.error} [Progress: ${completedCount}/${TOTAL_ORDERS}]`);

        errorLog.push({
          orderIndex: idx + 1,
          customerName: customer.name,
          customerPhone: customer.phone,
          errorPhase: record.errorPhase,
          errorMessage: record.error
        });
      }

      results[idx] = record;
    }
  };

  // Launch parallel workers
  console.log(`⚡ Spawning ${CONCURRENCY} concurrent workers to execute 100 orders...\n`);
  const workers = [];
  for (let w = 1; w <= CONCURRENCY; w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  const totalDurationSec = ((Date.now() - overallStartTime) / 1000).toFixed(1);

  // --------------------------------------------------------------------------
  // POST-EXECUTION DATABASE INTEGRITY & COLLISION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('🔍 CONDUCTING POST-EXECUTION DATABASE INTEGRITY & COLLISION AUDIT');
  console.log('================================================================================');

  const createdOrderIds = results.filter(r => r.clientOrderId).map(r => r.clientOrderId);
  let duplicateOrders = [];
  let duplicateSuborders = [];
  let paymentProblems = [];
  let outboxEntries = [];

  if (createdOrderIds.length > 0) {
    // 1. Check for Duplicate Order Numbers
    const [dupOrderRows] = await pool.query(`
      SELECT number, COUNT(*) as count 
      FROM client_orders 
      WHERE id IN (?) 
      GROUP BY number 
      HAVING count > 1
    `, [createdOrderIds]);
    duplicateOrders = dupOrderRows;

    // 2. Check for Duplicate Suborder IDs
    const [dupSubRows] = await pool.query(`
      SELECT id, COUNT(*) as count 
      FROM client_order_details 
      WHERE client_order_id IN (?) 
      GROUP BY id 
      HAVING count > 1
    `, [createdOrderIds]);
    duplicateSuborders = dupSubRows;

    // 3. Check for any orders stuck in payment_problems
    const [ppRows] = await pool.query(`
      SELECT pp.*, co.number as order_number 
      FROM payment_problems pp
      JOIN client_orders co ON co.id = pp.client_order_id
      WHERE pp.client_order_id IN (?)
    `, [createdOrderIds]);
    paymentProblems = ppRows;

    // 4. Check outbox records
    const [outboxRows] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM payment_job_outbox 
      WHERE client_order_id IN (?)
    `, [createdOrderIds]);
    outboxEntries = outboxRows;
  }

  // --------------------------------------------------------------------------
  // CALCULATE METRICS & LATENCY STATISTICS
  // --------------------------------------------------------------------------
  const successfulResults = results.filter(r => r.success);
  const totalTimes = successfulResults.map(r => r.durationMs);

  const stats = {
    totalRequested: TOTAL_ORDERS,
    totalCompleted: completedCount,
    successCount,
    failureCount,
    successRate: `${((successCount / TOTAL_ORDERS) * 100).toFixed(1)}%`,
    totalDurationSec: `${totalDurationSec}s`,
    throughput: `${(successCount / parseFloat(totalDurationSec)).toFixed(2)} orders/sec`,
    concurrency: CONCURRENCY,
    latencyMs: {
      min: totalTimes.length > 0 ? Math.min(...totalTimes) : 0,
      max: totalTimes.length > 0 ? Math.max(...totalTimes) : 0,
      avg: totalTimes.length > 0 ? Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length) : 0,
      p50: percentile(totalTimes, 50),
      p90: percentile(totalTimes, 90),
      p95: percentile(totalTimes, 95),
      p99: percentile(totalTimes, 99)
    },
    phaseAverageMs: {
      auth: phaseTimings.auth.length > 0 ? Math.round(phaseTimings.auth.reduce((a, b) => a + b, 0) / phaseTimings.auth.length) : 0,
      profileUpdate: phaseTimings.profileUpdate.length > 0 ? Math.round(phaseTimings.profileUpdate.reduce((a, b) => a + b, 0) / phaseTimings.profileUpdate.length) : 0,
      addToCart: phaseTimings.addToCart.length > 0 ? Math.round(phaseTimings.addToCart.reduce((a, b) => a + b, 0) / phaseTimings.addToCart.length) : 0,
      getCart: phaseTimings.getCart.length > 0 ? Math.round(phaseTimings.getCart.reduce((a, b) => a + b, 0) / phaseTimings.getCart.length) : 0,
      initiatePayment: phaseTimings.initiatePayment.length > 0 ? Math.round(phaseTimings.initiatePayment.reduce((a, b) => a + b, 0) / phaseTimings.initiatePayment.length) : 0,
      reconcile: phaseTimings.reconcile.length > 0 ? Math.round(phaseTimings.reconcile.reduce((a, b) => a + b, 0) / phaseTimings.reconcile.length) : 0,
      verify: phaseTimings.verify.length > 0 ? Math.round(phaseTimings.verify.reduce((a, b) => a + b, 0) / phaseTimings.verify.length) : 0
    },
    visibility: {
      orderManagementCount: successfulResults.filter(r => r.inOrderManagement).length,
      closeDistributionCount: successfulResults.filter(r => r.inCloseDistribution).length,
      setOrderCount: successfulResults.filter(r => r.inSetOrder).length
    },
    integrityAudit: {
      duplicateOrderNumbers: duplicateOrders.length,
      duplicateSuborders: duplicateSuborders.length,
      stuckInPaymentProblems: paymentProblems.length,
      outboxEntriesCreated: outboxEntries[0]?.count || 0
    },
    errors: errorLog
  };

  // --------------------------------------------------------------------------
  // PRINT EXECUTIVE SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('📊 FINAL 100-ORDER CONCURRENT EXECUTION REPORT');
  console.log('================================================================================');
  console.log(`⏱️ Total Time Elapsed:       ${stats.totalDurationSec} (${stats.throughput})`);
  console.log(`✅ Successful Orders:        ${stats.successCount} / ${stats.totalRequested} (${stats.successRate})`);
  console.log(`❌ Failed Orders:            ${stats.failureCount} / ${stats.totalRequested}`);
  console.log(`👤 Distinct Users Placed:    ${stats.successCount} Unique User Accounts`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`⚡ LATENCY METRICS:`);
  console.log(`   - Min Duration:           ${(stats.latencyMs.min / 1000).toFixed(2)}s`);
  console.log(`   - Average Duration:       ${(stats.latencyMs.avg / 1000).toFixed(2)}s`);
  console.log(`   - Median (p50):           ${(stats.latencyMs.p50 / 1000).toFixed(2)}s`);
  console.log(`   - 90th Percentile (p90):  ${(stats.latencyMs.p90 / 1000).toFixed(2)}s`);
  console.log(`   - 95th Percentile (p95):  ${(stats.latencyMs.p95 / 1000).toFixed(2)}s`);
  console.log(`   - Max Duration:           ${(stats.latencyMs.max / 1000).toFixed(2)}s`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`⏱️ PHASE LATENCY BREAKDOWN (Average per Order):`);
  console.log(`   - 1. Guest Auth:          ${(stats.phaseAverageMs.auth / 1000).toFixed(2)}s`);
  console.log(`   - 2. DB User Update:      ${(stats.phaseAverageMs.profileUpdate / 1000).toFixed(2)}s`);
  console.log(`   - 3. Add to Cart:         ${(stats.phaseAverageMs.addToCart / 1000).toFixed(2)}s`);
  console.log(`   - 4. Get Cart / Order:    ${(stats.phaseAverageMs.getCart / 1000).toFixed(2)}s`);
  console.log(`   - 5. Initiate Payment:    ${(stats.phaseAverageMs.initiatePayment / 1000).toFixed(2)}s`);
  console.log(`   - 6. Reconcile DB:        ${(stats.phaseAverageMs.reconcile / 1000).toFixed(2)}s`);
  console.log(`   - 7. Verify Admin State:  ${(stats.phaseAverageMs.verify / 1000).toFixed(2)}s`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`🎯 ADMIN VISIBILITY BREAKDOWN:`);
  console.log(`   - Order Management:       ${stats.visibility.orderManagementCount} / ${stats.successCount} (${((stats.visibility.orderManagementCount / stats.successCount) * 100).toFixed(1)}%) ✅`);
  console.log(`   - Close Distribution:     ${stats.visibility.closeDistributionCount} / ${stats.successCount} (Packages with Need Delivery = 0) ✅`);
  console.log(`   - Set Order (Driver):     ${stats.visibility.setOrderCount} / ${stats.successCount} (Packages with Need Delivery = 1) 🚚`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`🛡️ DATABASE INTEGRITY & COLLISION AUDIT:`);
  console.log(`   - Duplicate Order Numbers: ${stats.integrityAudit.duplicateOrderNumbers === 0 ? '0 (None! Unique generation preserved ✅)' : `⚠️ ${stats.integrityAudit.duplicateOrderNumbers} duplicates found!`}`);
  console.log(`   - Duplicate Suborder IDs:  ${stats.integrityAudit.duplicateSuborders === 0 ? '0 (None! Primary keys intact ✅)' : `⚠️ ${stats.integrityAudit.duplicateSuborders} duplicates found!`}`);
  console.log(`   - Stuck Payment Problems:  ${stats.integrityAudit.stuckInPaymentProblems === 0 ? '0 (None! Clean reconciliation ✅)' : `⚠️ ${stats.integrityAudit.stuckInPaymentProblems} stuck!`}`);
  console.log(`   - Outbox Events Logged:    ${stats.integrityAudit.outboxEntriesCreated} outbox records created ✅`);
  console.log(`================================================================================\n`);

  if (errorLog.length > 0) {
    console.log('⚠️ DETECTED ISSUES / ERRORS DURING RUN:');
    console.table(errorLog);
  } else {
    console.log('🎉 ZERO ERRORS! All 100 orders executed and verified cleanly under concurrency!\n');
  }

  // Save JSON report
  const reportPath = path.join(__dirname, 'test_100_orders_results.json');
  fs.writeFileSync(reportPath, JSON.stringify({ stats, results }, null, 2));
  console.log(`💾 Detailed JSON results saved to: ${reportPath}`);

  return stats;
}

if (require.main === module) {
  run100ConcurrentOrdersTest()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Fatal crash:', err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = run100ConcurrentOrdersTest;
