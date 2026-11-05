const axios = require('axios');
const pool = require('../src/config/db');

async function checkProfile() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  try {
    const loginRes = await axios.post(`${baseApi}/api/v2/Accounts/login`, {
      countryCode: '880',
      mobileNumber: '1772173075',
      token: '1234',
      sendNew: true
    });
    const token = loginRes.data.accessToken;
    const res = await axios.get(`${baseApi}/api/v2/Profiles/GetMyProfile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('User Profile from API:');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkProfile();

