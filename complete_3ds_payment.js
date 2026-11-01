require('dotenv').config();
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runFullPaymentWith3DS() {
  const base = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';

  console.log('1. Creating Guest session...');
  const guestRes = await axios.post(`${base}/api/v2/Accounts/AccessGuestUser`);
  const token = guestRes.data.accessToken;

  console.log('2. Adding Close Distribution Item (Masjid Al-Haram, 5 Cartons) to Cart...');
  await axios.post(`${base}/api/v2/carts/add-new-sale-item`, {
    sale_item_id: 95,
    quantity: 1,
    home_icon_id: 3
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const myCart = await axios.get(`${base}/api/v2/carts/get-my-cart-order`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const cartId = myCart.data.order.id;
  const orderNumber = myCart.data.order.number;
  console.log(`📦 Cart ID: ${cartId} | Order Number: ${orderNumber}`);

  console.log('3. Initiating MyFatoorah web payment...');
  const webPay = await axios.post(`${base}/api/v2/web-payments/initiate/myfatoorah`, {
    cart_id: cartId,
    callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
    errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
    paymentMethodId: 2,
    phoneNumber: '008801772173075',
    name: 'Shahriar Mahmud',
    email: 'customer@qataratapp.com'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const paymentUrl = webPay.data.payment_url;
  console.log('💳 Payment URL:', paymentUrl);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('qatarat') || url.includes('myfatoorah') || url.includes('callback') || url.includes('success')) {
      console.log(`📡 [HTTP ${res.status()}] ${url.split('?')[0]}`);
    }
  });

  console.log('4. Navigating to MyFatoorah checkout...');
  await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  // Type card details
  console.log('5. Entering Card Details (4111 1111 1111 1111 | 01/27 | 123)...');
  await page.type('input#cardholdername', 'Shahriar Mahmud', { delay: 40 });
  await page.type('input#cardnumber', '4111111111111111', { delay: 40 });
  await page.type('input#expirationdate', '0127', { delay: 40 });
  await page.type('input#securitycode', '123', { delay: 40 });
  await sleep(1000);

  console.log('6. Clicking Pay Now...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('pay now'));
    if (btn) btn.click();
  });

  console.log('7. Waiting for MPGS 3DS Challenge / Authentication...');
  await sleep(5000);

  // Check frames for 3DS challenge frame
  const frames = page.frames();
  console.log(`Total Frames: ${frames.length}`);
  for (let i = 0; i < frames.length; i++) {
    const fUrl = frames[i].url();
    console.log(`Frame ${i}: ${fUrl}`);
    if (fUrl.includes('Mastercard') || fUrl.includes('mpgs') || fUrl.includes('3ds') || fUrl.includes('challenge') || fUrl.includes('myfatoorah')) {
      try {
        const clicked = await frames[i].evaluate(() => {
          const btn = document.querySelector('button[type="submit"], input[type="submit"], #btnSubmit, button.submit-button, input[value*="Submit"], button');
          if (btn) {
            btn.click();
            return btn.innerText || btn.value || 'Clicked';
          }
          return null;
        });
        if (clicked) {
          console.log(`👉 Submitted 3DS inside Frame ${i}: "${clicked}"`);
        }
      } catch(e) {}
    }
  }

  console.log('8. Waiting for redirect callback to complete...');
  await sleep(8000);
  console.log(`📍 Final URL: ${page.url()}`);
  await page.screenshot({ path: 'final_3ds_result.png' });
  console.log('📸 Screenshot saved: final_3ds_result.png');

  await browser.close();

  // 9. Database Verification
  console.log('\n===============================================================');
  console.log('🔍 9. VERIFYING DATABASE PAYMENT STATUS FOR ORDER #' + orderNumber);
  console.log('===============================================================');
  const conn = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const [dbOrder] = await conn.query('SELECT id, number, client_order_status, payment_date, cost, payment_gateway, client_id, created_at FROM client_orders WHERE number = ?', [orderNumber]);
  console.log('Order in DB:', dbOrder);

  // Check if recorded in payment_problems or paid list
  const [problems] = await conn.query('SELECT * FROM payment_problems WHERE client_order_id = ?', [dbOrder[0]?.id || 0]);
  console.log('Payment Problems:', problems);

  const [paidList] = await conn.query('SELECT id, number, client_order_status, payment_date, cost FROM client_orders WHERE payment_date IS NOT NULL ORDER BY id DESC LIMIT 3');
  console.log('\nTop 3 Orders in Admin Order Management:');
  console.table(paidList);

  await conn.end();
}

runFullPaymentWith3DS();
