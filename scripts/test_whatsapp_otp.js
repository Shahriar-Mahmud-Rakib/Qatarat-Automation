const axios = require('axios');

async function testSendWhatsAppOtp() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  console.log('--- Testing SendWhatsAppOtp for 8801772173075 ---');
  try {
    const res = await axios.post(`${baseApi}/api/v2/Accounts/SendWhatsAppOtp`, {
      countryCode: '880',
      mobileNumber: '1772173075',
      role: 'user'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    console.log('Status:', res.status);
    console.log('Response:', res.data);
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', err.response?.data || err.message);
  }
}

testSendWhatsAppOtp();

