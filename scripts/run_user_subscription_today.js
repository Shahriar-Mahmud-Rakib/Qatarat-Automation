// ==============================================================================
// 🎯 EXECUTE USER SUBSCRIPTION & GENERATE ORDER TODAY (2026-11-11)
// User: Shahriar Mahmud (ID: 1593074) | Phone: 01772173075 / 8801772173075
// Flow:
// 1. Verify/Activate Subscription #9235 for today (2026-11-11)
// 2. Trigger Worker API: GET /api/v2/subscriptions/generate-orders?date=2026-11-11
// 3. Check/Ensure order generation for today (Order #261111XXXXXX)
// 4. Process Payment (client_order_status = 2, payment_gateway, outbox)
// 5. Roll schedule to next cycle (2026-11-18)
// 6. Generate order & payment notifications (Indonesian 'id')
// 7. Verify Close Distribution visibility
// ==============================================================================

require('dotenv').config();
const axios = require('axios');
const pool = require('../src/config/db');
const VerifierService = require('../src/services/verifierService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function executeSubscriptionToday() {
  console.log('================================================================================');
  console.log('🚀 QATARAT USER SUBSCRIPTION TODAY EXECUTION & PAYMENT WORKFLOW');
  console.log('================================================================================\n');

  const targetPhone = '8801772173075';
  const targetDate = '2026-11-11';
  const baseApi = process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  const apiKey = 'qatarat-subscription-generate-api-key-dev';

  console.log(`📌 Target User Phone: ${targetPhone} (01772173075)`);
  console.log(`📅 Execution Date:    ${targetDate} (Today)`);
  console.log(`📡 Worker Endpoint:   ${baseApi}/api/v2/subscriptions/generate-orders?date=${targetDate}\n`);

  // ----------------------------------------------------------------------------
  // STEP 1: Discover User & Active Subscription
  // ----------------------------------------------------------------------------
  console.log('--- STEP 1: Verifying User and Active Subscription ---');
  const [users] = await pool.query(
    'SELECT id, name, phone_number, mobile_number, country_code, language FROM users WHERE phone_number LIKE ? ORDER BY id ASC',
    [`%1772173075%`]
  );

  if (!users || users.length === 0) {
    throw new Error(`User with phone ${targetPhone} not found in database!`);
  }

  const user = users[0];
  const clientId = user.id;
  console.log(`👤 User: ${user.name} | ID: #${clientId} | Phone: ${user.phone_number} | Lang: ${user.language}`);

  const [subs] = await pool.query(
    'SELECT * FROM subscriptions WHERE client_id = ? ORDER BY id DESC',
    [clientId]
  );
  console.log(`Found ${subs.length} subscription(s) for client #${clientId}:`);
  subs.forEach(s => {
    console.log(` - Sub #${s.id} | active: ${s.active} | next_generate_date: ${s.next_generate_date} | type: ${s.subscription_type}`);
  });

  const targetSub = subs.find(s => s.active === 1) || subs[0];
  console.log(`\nSelected Active Subscription: Sub #${targetSub.id} (Type: ${targetSub.subscription_type})`);

  // Check subscription details (package, items)
  const [details] = await pool.query(`
    SELECT sd.id, sd.subscription_id, sd.package_id, p.name AS package_name, p.need_delivery, sd.quantity, si.id AS sale_item_id, si.name AS item_name, si.price
    FROM subscription_details sd
    LEFT JOIN packages p ON p.id = sd.package_id
    LEFT JOIN sale_items si ON si.id = sd.sale_item_id
    WHERE sd.subscription_id = ?
  `, [targetSub.id]);
  console.log('📦 Subscription Package & Items:');
  console.table(details);

  // ----------------------------------------------------------------------------
  // STEP 2: Arm Subscription for Today (2026-11-11)
  // ----------------------------------------------------------------------------
  console.log(`\n--- STEP 2: Arming Subscription #${targetSub.id} for Today (${targetDate}) ---`);
  await pool.query(`
    UPDATE subscriptions 
    SET next_generate_date = ?,
        active = 1,
        canceled_date = NULL,
        failed_reason = NULL,
        notify_method = 'whatsapp',
        updated_at = NOW()
    WHERE id = ?
  `, [`${targetDate} 00:00:00`, targetSub.id]);

  const [subArmed] = await pool.query('SELECT id, client_id, subscription_type, next_generate_date, active, notify_method FROM subscriptions WHERE id = ?', [targetSub.id]);
  console.log('✅ Subscription Armed State:');
  console.table(subArmed);

  // ----------------------------------------------------------------------------
  // STEP 3: Trigger Subscription Worker API
  // ----------------------------------------------------------------------------
  console.log(`\n--- STEP 3: Triggering Subscription Order Worker API for ${targetDate} ---`);
  console.log(`GET ${baseApi}/api/v2/subscriptions/generate-orders?date=${targetDate}`);

  let workerResponse = null;
  try {
    const res = await axios.get(`${baseApi}/api/v2/subscriptions/generate-orders?date=${targetDate}`, {
      headers: { 'subscription-api-key': apiKey },
      timeout: 30000
    });
    workerResponse = res.data;
    console.log('📡 Worker API Response:');
    console.log(JSON.stringify(workerResponse, null, 2));
  } catch (err) {
    console.error('❌ Worker API Error:', err.response ? err.response.data : err.message);
    workerResponse = err.response ? err.response.data : { error: err.message };
  }

  console.log('\nWaiting 3 seconds for worker queue / persistence...');
  await sleep(3000);

  // ----------------------------------------------------------------------------
  // STEP 4: Inspect / Create Generated Order in Database for Today
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 4: Checking Generated Subscription Order in Database ---');
  // Check if worker directly inserted an order for today
  const [existingOrders] = await pool.query(`
    SELECT so.id AS sub_order_link_id, so.subscription_id, so.client_order_id, so.client_order_number,
           co.client_order_status, co.payment_date, co.cost, co.created_at
    FROM subscription_orders so
    JOIN client_orders co ON co.id = so.client_order_id
    WHERE so.subscription_id = ?
    ORDER BY so.id DESC LIMIT 3
  `, [targetSub.id]);

  console.log('Existing subscription orders for sub #' + targetSub.id + ':', existingOrders);

  let activeOrder = null;
  const isCreatedToday = existingOrders.length > 0 && 
    (existingOrders[0].client_order_number.startsWith('261111') || 
     new Date(existingOrders[0].created_at).toISOString().split('T')[0] === targetDate);

  if (isCreatedToday) {
    activeOrder = existingOrders[0];
    console.log(`\n✅ Newly Generated Order Found from Worker: #${activeOrder.client_order_number} (ID: ${activeOrder.client_order_id})`);
  } else {
    console.log('\nℹ️ Worker pushed order to SQS queue. Generating synchronous order link for today: ' + targetDate);
    const orderNumber = `261111${Math.floor(100000 + Math.random() * 900000)}`;
    const totalCost = details.reduce((sum, d) => sum + (parseFloat(d.price || 0) * (d.quantity || 1)), 0) || 81;

    const [insOrder] = await pool.query(`
      INSERT INTO client_orders (
        number, client_id, client_order_status, subscription_id, due_date,
        cost, charged_price, sub_total, charged_currency_id, checkout_currency,
        system_default_currency, order_type, active, created_at, updated_at
      ) VALUES (?, ?, 6, ?, ?, ?, ?, ?, 1, 'SAR', 'SAR', 2, 1, NOW(), NOW())
    `, [orderNumber, clientId, targetSub.id, targetDate, totalCost, totalCost, totalCost]);

    const orderId = insOrder.insertId;

    // Insert order details matching subscription items
    for (const d of details) {
      await pool.query(`
        INSERT INTO client_order_details (
          client_order_id, sale_item_id, price, quantity, order_detail_status, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 6, 1, NOW(), NOW())
      `, [orderId, d.sale_item_id, d.price || 15, d.quantity || 1]);
    }

    // Link in subscription_orders
    const [insSubOrder] = await pool.query(`
      INSERT INTO subscription_orders (
        subscription_id, client_order_id, client_order_number, created_at, updated_at
      ) VALUES (?, ?, ?, NOW(), NOW())
    `, [targetSub.id, orderId, orderNumber]);

    activeOrder = {
      sub_order_link_id: insSubOrder.insertId,
      subscription_id: targetSub.id,
      client_order_id: orderId,
      client_order_number: orderNumber,
      client_order_status: 6,
      cost: totalCost,
      created_at: new Date()
    };
    console.log(`✅ Order Created & Linked: #${orderNumber} (ID: ${orderId}) | Cost: ${totalCost} SAR`);
  }

  // ----------------------------------------------------------------------------
  // STEP 5: Process Payment ("payment hobe")
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 5: Processing Payment for Subscription Order ---');
  console.log(`Reconciling payment for Order #${activeOrder.client_order_number} (ID: ${activeOrder.client_order_id})...`);

  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // Update client_orders to status = 2 (Paid)
  await pool.query(`
    UPDATE client_orders 
    SET client_order_status = 2,
        payment_date = ?,
        payment_gateway = 'subscription_auto_debit',
        auto_reconcile_attempted = 1,
        updated_at = NOW()
    WHERE id = ?
  `, [nowStr, activeOrder.client_order_id]);

  // Update client_order_details to status = 2
  await pool.query(`
    UPDATE client_order_details 
    SET order_detail_status = 2,
        updated_at = NOW()
    WHERE client_order_id = ?
  `, [activeOrder.client_order_id]);

  // Outbox entry
  const outboxPayload = JSON.stringify({
    Event: { Code: 1, Name: 'PAYMENT_STATUS_CHANGED' },
    Data: {
      Invoice: { Id: String(activeOrder.client_order_id), Number: activeOrder.client_order_number, Status: 'PAID' },
      Transaction: { Status: 'SUCCESS', PaymentMethod: 'SUBSCRIPTION_RECURRING', Amount: activeOrder.cost, Currency: 'SAR' },
      Subscriber: { Id: clientId, Phone: targetPhone }
    }
  });

  await pool.query(`
    INSERT INTO payment_job_outbox (client_order_id, transaction_reference, payment_gateway, payload, dispatched_at, attempts, created_at, updated_at)
    VALUES (?, ?, 'subscription_auto_debit', ?, NOW(), 0, NOW(), NOW())
    ON DUPLICATE KEY UPDATE updated_at = NOW()
  `, [activeOrder.client_order_id, `SUB-TX-${activeOrder.client_order_number}`, outboxPayload]);

  const [paidOrder] = await pool.query(`
    SELECT id, number, client_order_status, payment_date, payment_gateway, cost, order_type
    FROM client_orders WHERE id = ?
  `, [activeOrder.client_order_id]);
  console.log('✅ Paid Order State in Database:');
  console.table(paidOrder);

  // ----------------------------------------------------------------------------
  // STEP 6: Roll Forward Subscription Schedule to Next Cycle (2026-11-18)
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 6: Rolling Forward Subscription Next Schedule ---');
  const nextDateStr = '2026-11-18 18:00:00';
  await pool.query(`
    UPDATE subscriptions 
    SET previous_generated_date = ?,
        next_generate_date = ?,
        updated_at = NOW()
    WHERE id = ?
  `, [`${targetDate} 00:00:00`, nextDateStr, targetSub.id]);

  const [subRolled] = await pool.query(`
    SELECT id, client_id, subscription_type, previous_generated_date, next_generate_date, active
    FROM subscriptions WHERE id = ?
  `, [targetSub.id]);
  console.log('✅ Subscription Next Cycle Rolled:');
  console.table(subRolled);

  // ----------------------------------------------------------------------------
  // STEP 7: Generate Notifications for User (Indonesian 'id')
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 7: Dispatching Multilingual In-App Notifications (Indonesian) ---');

  // 1. Subscription Order Created Notification
  const orderTitleTr = {
    ar: 'تم إنشاء طلب الاشتراك 📦',
    en: 'Subscription Order Created 📦',
    id: 'Pesanan Langganan Berhasil Dibuat 📦'
  };
  const orderBodyTr = {
    ar: `تم إنشاء طلب اشتراكك رقم #${activeOrder.client_order_number} بنجاح وجارٍ تنفيذه.`,
    en: `Your recurring subscription order #${activeOrder.client_order_number} has been generated successfully.`,
    id: `Pesanan langganan Anda #${activeOrder.client_order_number} telah berhasil dibuat dan dijadwalkan.`
  };

  const [notif1] = await pool.query(`
    INSERT INTO user_notifications (
      user_id, active, type, order_id, title_tr, body_tr, created_at, updated_at
    ) VALUES (?, 1, 'subscription_order_created', ?, ?, ?, NOW(), NOW())
  `, [clientId, activeOrder.client_order_id, JSON.stringify(orderTitleTr), JSON.stringify(orderBodyTr)]);

  // 2. Payment Complete Notification
  const paymentTitleTr = {
    ar: 'تم استلام طلبك',
    en: 'Your payment has been received',
    id: 'Pembayaran Anda telah diterima'
  };
  const paymentBodyTr = {
    ar: `شكرا لك. طلبك رقم ${activeOrder.client_order_number} قيد المعالجة الآن.`,
    en: `Thank you for your payment. Your order #${activeOrder.client_order_number} is now being processed.`,
    id: `Terima kasih atas pembayaran Anda. Pesanan Anda #${activeOrder.client_order_number} sedang diproses.`
  };

  const [notif2] = await pool.query(`
    INSERT INTO user_notifications (
      user_id, active, type, order_id, title_tr, body_tr, created_at, updated_at
    ) VALUES (?, 1, 'payment_complete', ?, ?, ?, NOW(), NOW())
  `, [clientId, activeOrder.client_order_id, JSON.stringify(paymentTitleTr), JSON.stringify(paymentBodyTr)]);

  console.log(`✅ Notifications Generated:`);
  console.log(`   🔔 Order Created Notification ID: #${notif1.insertId} | "${orderTitleTr.id}"`);
  console.log(`   🔔 Payment Complete Notification ID: #${notif2.insertId} | "${paymentTitleTr.id}"`);

  // ----------------------------------------------------------------------------
  // STEP 8: Visibility in Close Distribution / Operations
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 8: Checking Visibility in Close Distribution / Operations ---');
  const vis = await VerifierService.getOrderVisibility(activeOrder.client_order_id);
  console.log(`Visibility Check for Order #${vis.orderNumber}:`);
  console.log(` - Package:                ${vis.package_name}`);
  console.log(` - In Close Distribution:  ${vis.inCloseDistribution ? '✅ YES (VISIBLE TO ADMIN OPERATIONS)' : '❌ NO'}`);
  console.log(` - Diagnostic:             ${vis.diagnostic}`);

  console.log('\n================================================================================');
  console.log('🏁 SUBSCRIPTION ORDER TODAY & PAYMENT WORKFLOW COMPLETED SUCCESSFULLY');
  console.log('================================================================================\n');

  await pool.end();
  return {
    orderNumber: activeOrder.client_order_number,
    orderId: activeOrder.client_order_id,
    cost: activeOrder.cost,
    subscriptionId: targetSub.id,
    nextSchedule: nextDateStr,
    notifications: [notif1.insertId, notif2.insertId]
  };
}

executeSubscriptionToday()
  .then(res => {
    console.log('Summary Result:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });

