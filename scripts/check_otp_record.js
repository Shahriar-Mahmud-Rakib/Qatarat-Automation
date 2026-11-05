const pool = require('../src/config/db');

async function checkOtpRecord() {
  try {
    const [otps] = await pool.query('SELECT * FROM sms_otp_requests WHERE mobile_number LIKE "%1772173075%" ORDER BY id DESC LIMIT 5');
    console.log('Recent OTP requests for 1772173075:');
    console.table(otps);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkOtpRecord();

