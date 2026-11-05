const pool = require('../src/config/db');

async function inspectSubDetails() {
  try {
    // 1. Check subscriptions that have a non-null failed_reason or notify_method
    const [sampleSubs] = await pool.query(`
      SELECT id, subscription_type, client_id, start_date, previous_generated_date, next_generate_date, 
             active, notify_method, failed_reason 
      FROM subscriptions 
      WHERE failed_reason IS NOT NULL OR notify_method IS NOT NULL
      ORDER BY id DESC LIMIT 10
    `);
    console.log('Sample subscriptions with failed_reason or notify_method:');
    console.table(sampleSubs);

    // 2. Check client user details for client_id in those sample subscriptions
    if (sampleSubs.length > 0) {
      const clientIds = sampleSubs.map(s => s.client_id).join(',');
      const [clientUsers] = await pool.query(`
        SELECT id, name, phone_number, mobile_number, country_code, language, role 
        FROM users 
        WHERE id IN (${clientIds})
      `);
      console.log('Associated users:');
      console.table(clientUsers);
    }

    // 3. Inspect recent subscription_orders
    const [recentSubOrders] = await pool.query(`
      SELECT so.id, so.subscription_id, so.client_order_id, so.client_order_number, so.created_at,
             co.client_order_status, co.client_id, co.payment_gateway
      FROM subscription_orders so
      JOIN client_orders co ON co.id = so.client_order_id
      ORDER BY so.id DESC LIMIT 10
    `);
    console.log('\nRecent subscription orders:');
    console.table(recentSubOrders);

    // 4. For those client orders, did user_notifications get generated?
    if (recentSubOrders.length > 0) {
      const orderIds = recentSubOrders.map(o => o.client_order_id).join(',');
      const [orderNotifs] = await pool.query(`
        SELECT id, user_id, order_id, type, title_tr, body_tr, created_at 
        FROM user_notifications 
        WHERE order_id IN (${orderIds})
      `);
      console.log('\nNotifications for recent subscription orders:');
      console.log(orderNotifs);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectSubDetails();

