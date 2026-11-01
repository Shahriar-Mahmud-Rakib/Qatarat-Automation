require('dotenv').config();
const puppeteer = require('puppeteer-core');
const mysql = require('mysql2/promise');
const axios = require('axios');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function resolvePaymentProblem() {
  console.log('===============================================================');
  console.log('🚀 AUTOMATING ADMIN TO COMPLETE PAYMENT PROBLEM #10704');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let adminToken = null;

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/admin/v2/')) {
      console.log(`📡 [Admin API ${res.status()}] ${url.split('?')[0]}`);
      try {
        const text = await res.text();
        if (text.includes('token') || text.includes('access_token')) {
          console.log(`🔑 Auth response captured: ${text.slice(0, 150)}`);
        }
      } catch(e) {}
    }
  });

  try {
    console.log('1. Navigating to Admin Login...');
    await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2500);

    const adminPhone = process.env.ADMIN_PHONE || '8801772173075';
    console.log(`2. Entering Admin Phone: ${adminPhone}...`);
    
    await page.waitForSelector('input', { timeout: 10000 });
    const input = await page.$('input[type="text"], input');
    if (input) {
      await input.click({ clickCount: 3 });
      await input.type(adminPhone);
    }
    await sleep(1500);

    // Click Turnstile if present
    for (const f of page.frames()) {
      if (f.url().includes('cloudflare.com')) {
        try {
          const checkbox = await f.$('#challenge-stage, .ctp-checkbox-label, input');
          if (checkbox) {
            console.log('👉 Clicking Turnstile Checkbox...');
            await checkbox.click();
            await sleep(2000);
          }
        } catch(e) {}
      }
    }

    console.log('3. Submitting Login Form...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم'));
      if (btn) btn.click();
    });

    await sleep(5000);

    // Check DB for OTP
    const conn = await mysql.createConnection({
      host: '13.215.213.102',
      port: 3306,
      user: 'qatarat-prod-db-replica-user',
      password: 'Kbzz8ef82K0tdJCHtCcG',
      database: 'qatarat-prod-db-replica'
    });

    const [users] = await conn.query('SELECT id, phone_number, otp_code, updated_at FROM users WHERE id = 1593074');
    console.log('Admin OTP in DB:', users[0]);

    if (users[0]?.otp_code) {
      const otp = users[0].otp_code;
      console.log(`4. Typing OTP: ${otp}...`);
      
      const otpInput = await page.$('input[type="password"], input[type="text"], input');
      if (otpInput) {
        await otpInput.type(otp);
        await sleep(1000);
        
        await page.evaluate(() => {
          const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تأكيد') || b.innerText.includes('Confirm') || b.innerText.includes('يُقدِّم'));
          if (btn) btn.click();
        });
        await sleep(5000);
      }
    }

    // Capture Token from localStorage
    adminToken = await page.evaluate(() => {
      return localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('auth_token') || sessionStorage.getItem('token');
    });
    console.log('Admin Bearer Token from Browser:', adminToken ? `${adminToken.slice(0, 30)}...` : 'Not in localStorage');

    // 5. Navigate directly to Payment Problem 10704
    console.log('\n5. Navigating to Payment Problem 10704 Details page...');
    await page.goto('https://stage-admin.qataratapp.com/payment-problems/10704', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(3000);
    await page.screenshot({ path: 'admin_payment_problem_10704.png' });
    console.log('📸 Screenshot saved: admin_payment_problem_10704.png');

    // 6. Click Action Dropdown -> Complete the Payment Process
    console.log('6. Opening Action dropdown menu and clicking "Complete the Payment Process"...');
    
    // Click the 3-line action button on table
    const actionClicked = await page.evaluate(() => {
      const actionBtn = document.querySelector('button.mdi-menu, button i.mdi-menu, i.mdi-menu, button.v-btn') || Array.from(document.querySelectorAll('button')).find(b => b.querySelector('i.mdi-menu') || b.innerText.includes('Action'));
      if (actionBtn) {
        actionBtn.click();
        return true;
      }
      return false;
    });
    console.log('Action menu opened:', actionClicked);
    await sleep(1500);

    // Click "Complete the Payment Process"
    const completeClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.v-list-item, button, div, span, a'));
      const completeItem = items.find(el => (el.innerText || '').toLowerCase().includes('complete the payment process') || (el.innerText || '').includes('Complete the Payment'));
      if (completeItem) {
        completeItem.click();
        return completeItem.innerText.trim();
      }
      return null;
    });

    console.log(`👉 Clicked menu item: "${completeClicked || 'Not Found'}"`);
    await sleep(3000);
    await page.screenshot({ path: 'admin_after_complete_click.png' });
    console.log('📸 Screenshot saved: admin_after_complete_click.png');

    // Check if a modal / confirm dialog opened
    const confirmClicked = await page.evaluate(() => {
      const modalBtns = Array.from(document.querySelectorAll('.v-dialog button, .v-overlay button, button'));
      const yesBtn = modalBtns.find(b => (b.innerText || '').toLowerCase().includes('yes') || (b.innerText || '').toLowerCase().includes('confirm') || (b.innerText || '').includes('تأكيد') || (b.innerText || '').includes('موافق'));
      if (yesBtn) {
        yesBtn.click();
        return yesBtn.innerText.trim();
      }
      return null;
    });

    console.log(`👉 Confirmed in dialog: "${confirmClicked || 'No Dialog'}"`);
    await sleep(5000);
    await page.screenshot({ path: 'admin_final_result.png' });

    await conn.end();
  } catch(err) {
    console.error('❌ Error in flow:', err.message);
  } finally {
    await browser.close();
  }

  // 7. Verify Database
  console.log('\n===============================================================');
  console.log('🔍 7. VERIFYING DATABASE FOR ORDER #260928721119');
  console.log('===============================================================');
  const conn2 = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const [dbOrder] = await conn2.query('SELECT id, number, client_order_status, payment_date, cost, payment_gateway, created_at FROM client_orders WHERE number = "260928721119"');
  console.log('Order in DB:', dbOrder[0]);

  const [topOrders] = await conn2.query(`
    SELECT co.id, co.number, co.client_order_status, co.payment_date, u.phone_number, co.cost
    FROM client_orders co
    LEFT JOIN users u ON u.id = co.client_id
    WHERE co.payment_date IS NOT NULL
    ORDER BY co.id DESC
    LIMIT 3
  `);
  console.log('\nTop Orders in Order Management:');
  console.table(topOrders);

  await conn2.end();
}

resolvePaymentProblem();
