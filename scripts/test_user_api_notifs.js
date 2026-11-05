const axios = require('axios');
const pool = require('../src/config/db');

async function testUserLoginAndNotifs() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  try {
    // 1. Set known OTP
    await pool.query('UPDATE users SET otp_code = "1234" WHERE id = 1593074');
    
    // 2. Call login API
    const loginRes = await axios.post(`${baseApi}/api/v2/Accounts/login`, {
      countryCode: '880',
      mobileNumber: '1772173075',
      token: '1234',
      sendNew: true
    });
    console.log('Login Status:', loginRes.status);
    console.log('User ID:', loginRes.data.id);
    const token = loginRes.data.accessToken;
    console.log('Token (first 30 chars):', token.substring(0, 30) + '...');

    // 3. Test possible notification endpoints
    const candidates = [
      '/api/v2/user-notifications',
      '/api/v2/user/notifications',
      '/api/v2/Notifications',
      '/api/v2/Profiles/Notifications',
      '/api/v2/Profiles/GetMyProfile',
      '/api/v2/notifications'
    ];

    for (const ep of candidates) {
      try {
        const res = await axios.get(`${baseApi}${ep}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept-Language': 'id'
          }
        });
        console.log(`Endpoint ${ep} → Status: ${res.status}`);
        console.log('Data:', JSON.stringify(res.data).substring(0, 200));
      } catch (e) {
        console.log(`Endpoint ${ep} → Error ${e.response?.status || e.message}`);
      }
    }

  } catch (err) {
    console.error('Login error:', err.response?.data || err.message);
  } finally {
    await pool.end();
  }
}

testUserLoginAndNotifs();

