const pool = require('../src/config/db');

async function checkOrderDetails() {
  try {
    const [orders] = await pool.query(`
      SELECT co.*, so.subscription_id, so.client_order_number as so_num
      FROM client_orders co
      LEFT JOIN subscription_orders so ON so.client_order_id = co.id
      WHERE co.id IN (1000675, 1000676, 1000677)
    `);
    console.log('Orders 1000675, 1000676, 1000677:');
    console.table(orders.map(o => ({
      id: o.id,
      number: o.number,
      client_id: o.client_id,
      status: o.client_order_status,
      subscription_id: o.subscription_id,
      created_at: o.created_at,
      payment_date: o.payment_date,
      payment_gateway: o.payment_gateway
    })));

    // Check notifications for these orders
    const [notifs] = await pool.query(`
      SELECT id, user_id, order_id, type, title_tr, body_tr, created_at
      FROM user_notifications
      WHERE order_id IN (1000675, 1000676, 1000677)
    `);
    console.log('\nNotifications:');
    console.log(JSON.stringify(notifs, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkOrderDetails();

