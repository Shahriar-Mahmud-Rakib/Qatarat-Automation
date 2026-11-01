require('dotenv').config();
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runCompleteKnetPayment() {
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
    if (url.includes('qatarat') || url.includes('myfatoorah') || url.includes('kpay') || url.includes('success')) {
      console.log(`📡 [HTTP ${res.status()}] ${url.split('?')[0]}`);
    }
  });

  console.log('4. Navigating to MyFatoorah checkout...');
  await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  // Type card details
  console.log('5. Entering Card Details...');
  await page.type('input#cardholdername', 'Shahriar Mahmud', { delay: 30 });
  await page.type('input#cardnumber', '4111111111111111', { delay: 30 });
  await page.type('input#expirationdate', '0127', { delay: 30 });
  await page.type('input#securitycode', '123', { delay: 30 });
  await sleep(1000);

  console.log('6. Clicking Pay Now...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('pay now'));
    if (btn) btn.click();
  });

  console.log('7. Waiting for KNET / 3DS Gateway...');
  await sleep(6000);

  // Check if we are on KNET simulator or 3DS
  console.log(`Current URL: ${page.url()}`);
  await page.screenshot({ path: 'knet_screen.png' });

  // If on KNET simulator page
  if (page.url().includes('kpaytest') || page.url().includes('knet')) {
    console.log('👉 KNET Test Simulator detected! Filling test pin and submitting...');
    
    // Check inputs on KNET page
    const knetInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, button')).map(el => ({
        id: el.id,
        name: el.name,
        type: el.type,
        value: el.value
      }));
    });
    console.log('KNET Inputs:', knetInputs);

    // Select prefix or enter pin
    await page.evaluate(() => {
      const pin = document.querySelector('input[name*="pin"], input[type="password"], #cardPin');
      if (pin) pin.value = '1234';
      const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], #Submit, input[value*="Submit"]');
      if (submitBtn) submitBtn.click();
    });

    console.log('8. Submitted KNET, waiting for payment success callback redirect...');
    await sleep(8000);
  }

  console.log(`📍 Final URL after full flow: ${page.url()}`);
  await page.screenshot({ path: 'payment_completed_screen.png' });
  console.log('📸 Screenshot saved: payment_completed_screen.png');

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

  // Check top orders with payment_date
  const [paidList] = await conn.query('SELECT id, number, client_order_status, payment_date, cost FROM client_orders WHERE payment_date IS NOT NULL ORDER BY id DESC LIMIT 3');
  console.log('\nTop Orders with Payment Date (Order Management List):');
  console.table(paidList);

  await conn.end();
}

runCompleteKnetPayment();
