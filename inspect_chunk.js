const axios = require('axios');

async function inspectAllApiCalls() {
  const js = (await axios.get('https://stage-admin.qataratapp.com/_nuxt/CBdGrw3J.js')).data;
  
  // Find all API endpoints called with apiBaseUrl
  const apis = [];
  const parts = js.split('`');
  for (const p of parts) {
    if (p.includes('${$}/') || p.includes('/payment-problem') || p.includes('/complete') || p.includes('/order')) {
      apis.push(p);
    }
  }

  console.log('All API URLs in Payment Problem Details chunk:');
  apis.forEach(a => console.log(' -> ', a));
}

inspectAllApiCalls();
