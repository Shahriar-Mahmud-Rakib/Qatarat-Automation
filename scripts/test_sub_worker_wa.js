const pool = require('../src/config/db');
const axios = require('axios');

async function testSubscriptionWorkerWhatsApp() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  const apiKey = 'qatarat-subscription-generate-api-key-dev';

  try {
    console.log('--- Setting subscription 9235 notify_method = "whatsapp" ---');
    await pool.query(`
      UPDATE subscriptions 
      SET notify_method = 'whatsapp',
          failed_reason = NULL,
          next_generate_date = NOW()
      WHERE id = 9235
    `);

    // Verify sub state
    const [subBefore] = await pool.query('SELECT id, client_id, notify_method, failed_reason, next_generate_date FROM subscriptions WHERE id = 9235');
    console.log('Sub before worker:', subBefore[0]);

    // Call worker
    const today = new Date().toISOString().split('T')[0];
    console.log(`Calling worker for date: ${today}`);
    const res = await axios.get(`${baseApi}/api/v2/subscriptions/generate-orders?date=${today}`, {
      headers: { 'subscription-api-key': apiKey }
    });
    console.log('Worker API response:', res.data);

    // Wait 3 seconds for async processing
    await new Promise(r => setTimeout(r, 3000));

    // Check failed_reason
    const [subAfter] = await pool.query('SELECT id, client_id, notify_method, failed_reason, next_generate_date FROM subscriptions WHERE id = 9235');
    console.log('Sub after worker:', subAfter[0]);

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  } finally {
    await pool.end();
  }
}

testSubscriptionWorkerWhatsApp();

