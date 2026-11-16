const pool = require('../src/config/db');

async function checkSentOrders() {
  try {
    const [rows] = await pool.query(`
      SELECT co.id, co.number, co.client_id, u.phone_number, u.country_code, u.mobile_number, co.cost, co.is_sent_payment_done_template, co.payment_date
      FROM client_orders co
      JOIN users u ON u.id = co.client_id
      WHERE co.is_sent_payment_done_template = 1
      ORDER BY co.id DESC LIMIT 5
    `);
    console.log('Orders where WhatsApp Payment Done Template was sent:');
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSentOrders();

