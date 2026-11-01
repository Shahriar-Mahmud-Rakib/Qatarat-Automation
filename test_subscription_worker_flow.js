require('dotenv').config();
const axios = require('axios');
const pool = require('./db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runSubscriptionWorkerTest() {
  console.log('================================================================================');
  console.log('🔄 TESTING SUBSCRIPTION WORKER ORDER GENERATION & CLOSE DISTRIBUTION FLOW');
  console.log('================================================================================\n');

  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  const apiKey = 'qatarat-subscription-generate-api-key-dev';

  // Step 1: Prepare Subscription 9216
  console.log('1. Setting Subscription 9216 next_generate_date to 2026-09-28 (Today)...');
  await pool.query(`
    UPDATE subscriptions 
    SET next_generate_date = '2026-09-28 00:00:00',
        active = 1,
        canceled_date = NULL
    WHERE id = 9216
  `);

  const [subBefore] = await pool.query(`
    SELECT s.id, s.subscription_type, s.client_id, s.next_generate_date, s.active, sd.package_id, p.name as pkg_name, p.need_delivery
    FROM subscriptions s
    JOIN subscription_details sd ON sd.subscription_id = s.id
    JOIN packages p ON p.id = sd.package_id
    WHERE s.id = 9216
  `);
  console.log('📋 Subscription 9216 Config:');
  console.table(subBefore);

  // Step 2: Trigger Worker API
  console.log('\n2. Triggering Subscription Generate Orders API:');
  console.log(`   URL: ${baseApi}/api/v2/subscriptions/generate-orders?date=2026-09-28`);
  
  let workerRes = null;
  try {
    const res = await axios.get(`${baseApi}/api/v2/subscriptions/generate-orders?date=2026-09-28`, {
      headers: {
        'subscription-api-key': apiKey
      }
    });
    workerRes = res.data;
    console.log('📡 Worker API Response:', JSON.stringify(workerRes, null, 2));
  } catch (err) {
    console.error('❌ Worker API Error:', err.response ? err.response.data : err.message);
  }

  await sleep(3000);

  // Step 3: Check generated orders in DB
  console.log('\n3. Checking generated orders in subscription_orders & client_orders...');
  const [latestSubOrders] = await pool.query(`
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
    WHERE so.subscription_id = 9216
    ORDER BY so.id DESC
    LIMIT 5
  `);

  console.log('📦 Generated Subscription Order Details in Database:');
  console.table(latestSubOrders);

  if (latestSubOrders.length === 0) {
    console.log('⚠️ No new order was generated for subscription 9216.');
    await pool.end();
    return;
  }

  const generatedOrderId = latestSubOrders[0].client_order_id;
  const generatedOrderNumber = latestSubOrders[0].client_order_number;
  console.log(`\n🎯 Newly Generated Order: #${generatedOrderNumber} (ID: ${generatedOrderId})`);
  console.log(`   Initial Status: ${latestSubOrders[0].client_order_status} (Subscription / Unpaid)`);
  console.log(`   Payment Date:   ${latestSubOrders[0].payment_date || 'NULL (Unpaid state)'}`);

  // Step 4: Check if it appears in Close Distribution right now (before payment)
  console.log('\n4. Checking Close Distribution visibility before payment:');
  const [cdCheckBefore] = await pool.query(`
    SELECT cod.id, co.number, co.client_order_status, co.payment_date
    FROM client_order_details cod
    JOIN client_orders co ON co.id = cod.client_order_id
    WHERE co.id = ? AND co.payment_date IS NOT NULL AND co.client_order_status IN (1, 2)
  `, [generatedOrderId]);
  console.log(`   Visible before payment? ${cdCheckBefore.length > 0 ? '✅ YES' : '❌ NO (Unpaid subscription orders are waiting for payment)'}`);

  // Step 5: Simulate Payment Confirmation (Customer pays subscription invoice / auto-debit)
  console.log('\n5. Simulating Payment Confirmation on Subscription Order (Payment Received)...');
  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  await pool.query(`
    UPDATE client_orders 
    SET client_order_status = 2,
        payment_date = ?,
        payment_gateway = 'subscription_auto_pay',
        updated_at = NOW()
    WHERE id = ?
  `, [nowStr, generatedOrderId]);

  await pool.query(`
    UPDATE client_order_details 
    SET order_detail_status = 2,
        updated_at = NOW()
    WHERE client_order_id = ?
  `, [generatedOrderId]);

  // Step 6: Verify Close Distribution Visibility after Payment
  console.log('\n6. Verifying Close Distribution table after payment:');
  const [cdCheckAfter] = await pool.query(`
    SELECT 
      cod.id AS suborder_id,
      co.id AS client_order_id,
      co.number AS main_order_number,
      co.client_order_status,
      co.payment_date,
      p.name AS package_name,
      p.need_delivery,
      cod.order_detail_status
    FROM client_order_details cod
    JOIN client_orders co ON co.id = cod.client_order_id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    WHERE co.id = ?
      AND co.payment_date IS NOT NULL
      AND co.client_order_status IN (1, 2)
      AND co.driver_id IS NULL
      AND (p.need_delivery = 0 OR p.need_delivery IS NULL)
      AND cod.sale_item_multi_distribution_group_id IS NULL
      AND cod.order_detail_status IN (1, 2)
  `, [generatedOrderId]);

  console.log('🎯 Close Distribution Query Result:');
  console.table(cdCheckAfter);

  if (cdCheckAfter.length > 0) {
    console.log(`\n🎉 SUCCESS! Generated Subscription Order #${generatedOrderNumber} is VISIBLE in CLOSE DISTRIBUTION (Suborder ID: ${cdCheckAfter[0].suborder_id})!`);
  } else {
    console.log(`\n❌ Not visible in Close Distribution.`);
  }

  // Step 7: Check Updated Subscription next_generate_date (+7 days)
  console.log('\n7. Checking Subscription next_generate_date in subscriptions table:');
  const [subAfter] = await pool.query(`
    SELECT id, subscription_type, start_date, previous_generated_date, next_generate_date, updated_at
    FROM subscriptions
    WHERE id = 9216
  `);
  console.table(subAfter);

  await pool.end();
}

runSubscriptionWorkerTest();
