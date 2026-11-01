require('dotenv').config();
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const pool = require('./db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('===============================================================');
  console.log('🔐 LOGGING INTO STAGE ADMIN & CALLING PAYMENT COMPLETION API');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  let bearerToken = null;

  page.on('request', req => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      bearerToken = auth.replace('Bearer ', '');
      console.log('🔑 Captured Bearer Token from request:', bearerToken.slice(0, 25) + '...');
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/admin/v2/auth/login') || url.includes('/admin/v2/auth/verify-otp') || url.includes('token')) {
      try {
        const json = await res.json();
        console.log(`📡 [Auth Response] ${url}:`, json);
        if (json.data && json.data.token) {
          bearerToken = json.data.token;
        } else if (json.token) {
          bearerToken = json.token;
        } else if (json.accessToken) {
          bearerToken = json.accessToken;
        }
      } catch(e) {}
    }
  });

  try {
    console.log('1. Navigating to https://stage-admin.qataratapp.com/auth/login ...');
    await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2000);

    const input = await page.$('input');
    if (input) {
      await input.click({ clickCount: 3 });
      await input.type('8801772173075');
    }
    await sleep(1500);

    // Click Turnstile if present
    for (const f of page.frames()) {
      if (f.url().includes('cloudflare.com')) {
        const cb = await f.$('#challenge-stage, .ctp-checkbox-label, input');
        if (cb) {
          console.log('👉 Clicking Turnstile...');
          await cb.click();
          await sleep(2000);
        }
      }
    }

    // Click submit
    console.log('2. Submitting phone number...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم') || b.innerText.includes('Submit'));
      if (btn) btn.click();
    });

    await sleep(4000);

    // Fetch OTP from DB
    const [users] = await pool.query('SELECT id, phone_number, otp_code FROM users WHERE phone_number LIKE "%8801772173075%"');
    console.log('User OTP in DB:', users[0]);
    const otp = users[0].otp_code;

    const otpInput = await page.$('input[type="password"], input[type="text"], input');
    if (otpInput) {
      console.log(`3. Entering OTP ${otp}...`);
      await otpInput.type(otp);
      await sleep(1000);
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تأكيد') || b.innerText.includes('Confirm'));
        if (btn) btn.click();
      });
      await sleep(5000);
    }

    const cookies = await page.cookies();
    const tokenCookie = cookies.find(c => c.name === 'token' || c.name === 'accessToken');
    if (tokenCookie) {
      bearerToken = tokenCookie.value;
      console.log('🔑 Found token in cookies:', bearerToken.slice(0, 25) + '...');
    }

    const storageTokens = await page.evaluate(() => {
      return {
        localStorageToken: localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('auth_token'),
        sessionStorageToken: sessionStorage.getItem('token'),
        cookieStr: document.cookie
      };
    });
    console.log('Storage inspection:', storageTokens);
    if (!bearerToken && storageTokens.localStorageToken) {
      bearerToken = storageTokens.localStorageToken;
    }

  } catch (err) {
    console.error('Error during login:', err.message);
  } finally {
    await browser.close();
  }

  if (!bearerToken) {
    console.error('❌ Could not obtain bearer token!');
    await pool.end();
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`🎯 BEARER TOKEN ACQUIRED: ${bearerToken.slice(0, 20)}...`);
  console.log(`===============================================================`);

  const apiBase = 'https://stage-admin-api.qataratapp.com/admin/v2';
  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    lang: 'en',
    Accept: 'application/json'
  };

  // 1. Get Details of Payment Problem 10704
  console.log('\n--- 1. Fetching Payment Problem #10704 Details ---');
  try {
    const res = await axios.get(`${apiBase}/payment-problems/10704`, { headers });
    console.log('Problem Details Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('Details Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }

  // 2. Try make-payment-complete on client_order_id (998098)
  console.log('\n--- 2. Trying POST /payment-problems/998098/make-payment-complete ---');
  try {
    const res = await axios.post(`${apiBase}/payment-problems/998098/make-payment-complete`, {}, { headers });
    console.log('make-payment-complete (998098) Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('make-payment-complete (998098) Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }

  // 3. Try make-payment-complete on problem_id (10704)
  console.log('\n--- 3. Trying POST /payment-problems/10704/make-payment-complete ---');
  try {
    const res = await axios.post(`${apiBase}/payment-problems/10704/make-payment-complete`, {}, { headers });
    console.log('make-payment-complete (10704) Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('make-payment-complete (10704) Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }

  // 4. Try toggle client order status on problem_id
  console.log('\n--- 4. Trying GET /payment-problems/make-toggle-client-order-status/10704 ---');
  try {
    const res = await axios.get(`${apiBase}/payment-problems/make-toggle-client-order-status/10704`, { headers });
    console.log('make-toggle-client-order-status (10704) Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('make-toggle-client-order-status (10704) Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }

  // 5. Try recalculate-payment
  console.log('\n--- 5. Trying GET /payment-problems/998098/recalculate-payment ---');
  try {
    const res = await axios.get(`${apiBase}/payment-problems/998098/recalculate-payment`, { headers });
    console.log('recalculate-payment (998098) Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('recalculate-payment (998098) Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }

  // 6. Check Database for updated order status
  console.log('\n===============================================================');
  console.log('🔍 6. VERIFYING DATABASE AFTER API CALLS');
  console.log('===============================================================');
  const [orders] = await pool.query('SELECT id, number, client_order_status, payment_date, cost, payment_gateway FROM client_orders WHERE id = 998098');
  console.log('Client Order in DB:', orders[0]);

  const [topOrders] = await pool.query(`
    SELECT co.id, co.number, co.client_order_status, co.payment_date, co.cost
    FROM client_orders co
    WHERE co.payment_date IS NOT NULL
    ORDER BY co.id DESC
    LIMIT 3
  `);
  console.log('\nTop Paid Orders:');
  console.table(topOrders);

  await pool.end();
}

run();
