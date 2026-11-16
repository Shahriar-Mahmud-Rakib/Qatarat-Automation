const pool = require('../src/config/db');

async function searchPaymentDoneTemplate() {
  try {
    const [orders] = await pool.query(`
      SELECT id, number, client_order_status, is_sent_payment_done_template, payment_gateway, payment_date
      FROM client_orders 
      WHERE is_sent_payment_done_template = 1 
      ORDER BY id DESC LIMIT 5
    `);
    console.log('Orders with is_sent_payment_done_template = 1:');
    console.table(orders);

    const [notSent] = await pool.query(`
      SELECT id, number, client_order_status, is_sent_payment_done_template, payment_gateway, payment_date
      FROM client_orders 
      WHERE client_order_status = 2 AND is_sent_payment_done_template = 0
      ORDER BY id DESC LIMIT 5
    `);
    console.log('Paid orders with is_sent_payment_done_template = 0:');
    console.table(notSent);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

searchPaymentDoneTemplate();

