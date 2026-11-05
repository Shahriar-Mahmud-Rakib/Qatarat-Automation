const pool = require('../src/config/db');

async function checkRecentOtp() {
  try {
    const [cols] = await pool.query('DESCRIBE sms_otp_requests');
    console.log('sms_otp_requests cols:', cols.map(c => c.Field));
    const [recent] = await pool.query('SELECT * FROM sms_otp_requests ORDER BY id DESC LIMIT 5');
    console.log('Recent 5 in sms_otp_requests:');
    console.table(recent);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRecentOtp();

