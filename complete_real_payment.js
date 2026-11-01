require('dotenv').config();
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runRealPayment() {
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
    if (res.url().includes('qatarat') || res.url().includes('myfatoorah')) {
      console.log('Payment Flow HTTP:', res.status(), res.url().split('?')[0]);
    }
  });

  console.log('4. Navigating to MyFatoorah checkout...');
  await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);

  // Focus and type into actual fields
  console.log('5. Typing cardholder name: Shahriar Mahmud...');
  await page.type('input#cardholdername', 'Shahriar Mahmud', { delay: 50 });
  
  console.log('6. Typing card number: 4111 1111 1111 1111...');
  await page.type('input#cardnumber', '4111111111111111', { delay: 50 });
  
  console.log('7. Typing expiry date: 01/27...');
  await page.type('input#expirationdate', '0127', { delay: 50 });
  
  console.log('8. Typing security code: 123...');
  await page.type('input#securitycode', '123', { delay: 50 });

  await sleep(1500);
  await page.screenshot({ path: 'myfatoorah_typed_details.png' });
  console.log('📸 Screenshot saved: myfatoorah_typed_details.png');

  console.log('9. Clicking Pay Now button...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('pay now'));
    if (btn) btn.click();
  });

  console.log('10. Waiting for payment processing and 3DS simulation redirect...');
  await sleep(10000);

  console.log('📍 Current URL after Pay:', page.url());
  await page.screenshot({ path: 'after_payment_submit.png' });

  // If 3DS OTP simulator page appeared
  const submit3ds = await page.$('button[type="submit"], input[type="submit"], #btnSubmit');
  if (submit3ds) {
    console.log('👉 3DS Simulation page detected! Submitting 3DS authorization...');
    await submit3ds.click();
    await sleep(8000);
    await page.screenshot({ path: 'after_3ds_submit.png' });
    console.log('📍 URL after 3DS submit:', page.url());
  }

  await browser.close();

  // 11. Check database for payment date and status
  console.log('\n===============================================================');
  console.log('🔍 11. CHECKING DATABASE STATUS FOR ORDER #' + orderNumber);
  console.log('===============================================================');
  const conn = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const [orders] = await conn.query('SELECT id, number, client_order_status, payment_date, cost, payment_gateway, client_id, created_at FROM client_orders WHERE number = ?', [orderNumber]);
  console.log('Order in DB:', orders);

  const [paymentProblems] = await conn.query('SELECT * FROM payment_problems WHERE client_order_id = ? OR tran_ref LIKE ?', [orders[0]?.id || 0, `%${orderNumber}%`]);
  console.log('Payment Problems check:', paymentProblems);

  const [closeDist] = await conn.query(`
    SELECT 
      co.id AS order_id,
      co.number AS order_number,
      co.client_order_status,
      co.payment_date,
      p.name AS package_name,
      p.need_delivery,
      cod.order_detail_status
    FROM client_orders co
    JOIN client_order_details cod ON cod.client_order_id = co.id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    WHERE co.number = ?
  `, [orderNumber]);
  console.log('Close Distribution DB Check:', closeDist);

  await conn.end();
}

runRealPayment();
