require('dotenv').config();
const axios = require('axios');
const pool = require('./src/config/db');
const VerifierService = require('./src/services/verifierService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const USERS_TO_TEST = [
  {
    index: 1,
    client_id: 1595860,
    phone_number: '008801772173075',
    name: 'Shahriar Mahmud (User 1)',
    subscription_id: 9216,
    package_name: 'Watering & Food Holy Mosque (Pkg 9)'
  },
  {
    index: 2,
    client_id: 1592992,
    phone_number: '008801867118351',
    name: 'Customer 2 (008801867118351)',
    subscription_id: 9214,
    package_name: 'Watering & Food Holy Mosque (Pkg 9)'
  },
  {
    index: 3,
    client_id: 1593044,
    phone_number: '008801634319696',
    name: 'Customer 3 (008801634319696)',
    subscription_id: 9213,
    package_name: 'Watering & Food Holy Mosque (Pkg 9)'
  },
  {
    index: 4,
    client_id: 1593170,
    phone_number: '008801685220417',
    name: 'Customer 4 (008801685220417)',
    subscription_id: 9212,
    package_name: 'Watering & Food Holy Mosque (Pkg 9)'
  },
  {
    index: 5,
    client_id: 1593777,
    phone_number: '008801867586482',
    name: 'Customer 5 (008801867586482)',
    subscription_id: 9217,
    package_name: 'Watering & Food Holy Mosque (Pkg 9)'
  }
];

async function run5UsersSubscriptionTest() {
  console.log('====================================================================================================');
  console.log('🚀 TESTING 5 DIFFERENT USERS SUBSCRIPTION GENERATION & CLOSE DISTRIBUTION FLOW');
  console.log('====================================================================================================\n');

  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  const apiKey = 'qatarat-subscription-generate-api-key-dev';

  // 1. Prepare 5 Users & Subscriptions
  console.log('1. Setting up 5 User Subscriptions (start_date: 7 days ago, next_generate_date: Today 2026-09-28)...');
  
  for (const u of USERS_TO_TEST) {
    // Ensure phone number in users table
    await pool.query('UPDATE users SET phone_number = ? WHERE id = ?', [u.phone_number, u.client_id]);

    // Set 7 days ago start_date and today next_generate_date
    await pool.query(`
      UPDATE subscriptions 
      SET subscription_type = 'weekly',
          start_date = '2026-09-21 00:00:00',
          next_generate_date = '2026-09-28 00:00:00',
          active = 1,
          canceled_date = NULL,
          updated_at = NOW()
      WHERE id = ?
    `, [u.subscription_id]);

    console.log(`   - [User ${u.index}/5] ${u.name} | Phone: ${u.phone_number} | Subscription ID: #${u.subscription_id}`);
  }

  // 2. Trigger Subscription Order Generation Worker API
  console.log('\n2. Calling Worker API: GET /api/v2/subscriptions/generate-orders?date=2026-09-28 ...');
  let workerRes = null;
  try {
    const res = await axios.get(`${baseApi}/api/v2/subscriptions/generate-orders?date=2026-09-28`, {
      headers: { 'subscription-api-key': apiKey }
    });
    workerRes = res.data;
    console.log('📡 Worker API Response:', JSON.stringify(workerRes, null, 2));
  } catch (err) {
    console.error('❌ Worker API Error:', err.response ? err.response.data : err.message);
  }

  await sleep(3500);

  // 3. Process and Verify each of the 5 users
  console.log('\n3. Verifying Order Generation, Payment Confirmation & Close Distribution for all 5 users:\n');

  const reportResults = [];

  for (const u of USERS_TO_TEST) {
    console.log(`----------------------------------------------------------------------------------------------------`);
    console.log(`▶️ Processing [User ${u.index}/5] ${u.name} (Subscription #${u.subscription_id})`);
    console.log(`----------------------------------------------------------------------------------------------------`);

    const result = {
      index: u.index,
      userName: u.name,
      phone: u.phone_number,
      subscriptionId: u.subscription_id,
      generatedOrderNumber: null,
      clientOrderId: null,
      suborderId: null,
      cost: null,
      initialStatus: null,
      inCloseDistribution: false,
      inOrderManagement: false,
      previousGenDate: null,
      nextGenDate: null,
      diagnostic: ''
    };

    try {
      // Find latest generated order
      const [orderRows] = await pool.query(`
        SELECT 
          so.id AS sub_order_link_id,
          so.subscription_id,
          so.client_order_id,
          so.client_order_number,
          co.client_order_status,
          co.payment_date,
          co.cost,
          co.created_at,
          p.id AS package_id,
          p.name AS package_name,
          p.need_delivery,
          cod.id AS suborder_id,
          cod.order_detail_status
        FROM subscription_orders so
        JOIN client_orders co ON co.id = so.client_order_id
        JOIN client_order_details cod ON cod.client_order_id = co.id
        JOIN sale_items si ON si.id = cod.sale_item_id
        JOIN packages p ON p.id = si.package_id
        WHERE so.subscription_id = ?
        ORDER BY so.id DESC
        LIMIT 1
      `, [u.subscription_id]);

      if (orderRows.length === 0) {
        result.diagnostic = '❌ No order generated by worker';
        reportResults.push(result);
        continue;
      }

      const ord = orderRows[0];
      result.generatedOrderNumber = ord.client_order_number;
      result.clientOrderId = ord.client_order_id;
      result.suborderId = ord.suborder_id;
      result.cost = ord.cost;
      result.initialStatus = `Status ${ord.client_order_status} (Waiting Payment)`;

      console.log(`   📦 Generated Order: #${result.generatedOrderNumber} (Client Order ID: ${result.clientOrderId}) | Suborder ID: ${result.suborderId}`);
      console.log(`   Initial State: ${result.initialStatus}`);

      // Simulate customer paying the weekly subscription invoice
      console.log(`   💳 Simulating Payment Completion (Status = 2 / Payment Received)...`);
      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      await pool.query(`
        UPDATE client_orders 
        SET client_order_status = 2,
            payment_date = ?,
            payment_gateway = 'subscription_weekly_pay',
            updated_at = NOW()
        WHERE id = ?
      `, [nowStr, result.clientOrderId]);

      await pool.query(`
        UPDATE client_order_details 
        SET order_detail_status = 2,
            updated_at = NOW()
        WHERE client_order_id = ?
      `, [result.clientOrderId]);

      // Check visibility across Admin
      const visibility = await VerifierService.getOrderVisibility(result.clientOrderId);
      result.inOrderManagement = visibility.inOrderManagement;
      result.inCloseDistribution = visibility.inCloseDistribution;

      // Check next_generate_date in subscriptions
      const [subRows] = await pool.query('SELECT previous_generated_date, next_generate_date FROM subscriptions WHERE id = ?', [u.subscription_id]);
      result.previousGenDate = subRows[0]?.previous_generated_date;
      result.nextGenDate = subRows[0]?.next_generate_date;
      result.diagnostic = visibility.diagnostic;

      console.log(`   🎯 Result:`);
      console.log(`      - Visible in Order Management:   ${result.inOrderManagement ? '✅ YES' : '❌ NO'}`);
      console.log(`      - Visible in Close Distribution: ${result.inCloseDistribution ? '✅ YES (Suborder: ' + result.suborderId + ')' : '❌ NO'}`);
      console.log(`      - Next Generate Date (+7 Days):  ${result.nextGenDate}`);

    } catch (err) {
      console.error(`   ❌ Error for user ${u.index}:`, err.message);
      result.diagnostic = 'ERROR: ' + err.message;
    }

    reportResults.push(result);
    await sleep(1000);
  }

  await pool.end();

  // 4. Print Summary Table
  console.log('\n\n====================================================================================================');
  console.log('📊 FINAL 5 USERS SUBSCRIPTION & CLOSE DISTRIBUTION SUMMARY REPORT');
  console.log('====================================================================================================');
  console.table(reportResults.map(r => ({
    '#': r.index,
    'User Phone': r.phone,
    'Sub ID': r.subscriptionId,
    'Generated Order #': r.generatedOrderNumber,
    'Suborder ID': r.suborderId,
    'Amount': `${r.cost} SAR`,
    'Order Mgmt': r.inOrderManagement ? '✅ YES' : '❌ NO',
    'Close Dist': r.inCloseDistribution ? '✅ YES' : '❌ NO',
    'Next Cycle (+7 Days)': r.nextGenDate ? new Date(r.nextGenDate).toISOString().split('T')[0] : 'N/A',
    'Status': r.inCloseDistribution ? '🎉 ACTIVE IN CLOSE DIST' : '⚠️ ISSUE'
  })));
}

run5UsersSubscriptionTest();
