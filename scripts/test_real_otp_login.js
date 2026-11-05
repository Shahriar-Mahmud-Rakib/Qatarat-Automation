const axios = require('axios');
const pool = require('../src/config/db');

async function testRealOtpLogin() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  try {
    // 1. Dispatch OTP
    console.log('Dispatching OTP...');
    await axios.post(`${baseApi}/api/v2/Accounts/SendWhatsAppOtp`, {
      countryCode: '880',
      mobileNumber: '1772173075',
      role: 'user'
    });

    // 2. Read OTP from DB
    const [rows] = await pool.query('SELECT otp_code FROM users WHERE id = 1593074');
    const realOtp = rows[0]?.otp_code;
    console.log('Real OTP from DB:', realOtp);

    // 3. Login with real OTP
    const loginRes = await axios.post(`${baseApi}/api/v2/Accounts/login`, {
      countryCode: '880',
      mobileNumber: '1772173075',
      token: String(realOtp),
      sendNew: true
    });

    console.log('Login successful! Status:', loginRes.status);
    const token = loginRes.data.accessToken;

    // 4. Get profile
    const profileRes = await axios.get(`${baseApi}/api/v2/Profiles/GetMyProfile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('User Profile from API:');
    console.log(profileRes.data);

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  } finally {
    await pool.end();
  }
}

testRealOtpLogin();

