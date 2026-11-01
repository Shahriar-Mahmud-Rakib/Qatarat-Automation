require('dotenv').config();
const puppeteer = require('puppeteer-core');
const pool = require('./db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runAdminVerificationFlow() {
  console.log('===============================================================');
  console.log('🔐 RUNNING ADMIN PORTAL & CLOSE DISTRIBUTION VERIFICATION');
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

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api') && !url.includes('turnstile') && !url.includes('google')) {
      console.log(`📡 [Admin API ${res.status()}] ${url.split('?')[0]}`);
      try {
        const text = await res.text();
        if (text.length < 300) {
          console.log(`   Response: ${text}`);
        }
      } catch(e) {}
    }
  });

  try {
    console.log('\n📍 1. Navigating to Stage Admin Login: https://stage-admin.qataratapp.com/auth/login ...');
    await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(3000);

    const adminPhone = process.env.ADMIN_PHONE || '8801772173075';
    console.log(`📍 2. Entering Admin Phone: ${adminPhone} ...`);
    
    await page.waitForSelector('input[type="text"], input', { timeout: 10000 });
    const input = await page.$('input[type="text"], input');
    if (input) {
      await input.click({ clickCount: 3 });
      await input.type(adminPhone);
    }
    await sleep(1500);

    // Wait for Cloudflare Turnstile token if present
    console.log('📍 3. Checking Turnstile Captcha...');
    for (const frame of page.frames()) {
      if (frame.url().includes('cloudflare.com')) {
        try {
          const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
          if (checkbox) {
            console.log('👉 Clicking Turnstile Checkbox...');
            await checkbox.click();
            await sleep(2000);
          }
        } catch(e) {}
      }
    }

    await page.screenshot({ path: 'admin_login_entered.png' });
    console.log('📸 Screenshot saved: admin_login_entered.png');

    console.log('📍 4. Submitting Login Form...');
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم') || b.innerText.includes('Submit'));
      if (submitBtn) submitBtn.click();
    });

    await sleep(4000);
    await page.screenshot({ path: 'admin_login_submitted.png' });
    console.log('📸 Screenshot saved: admin_login_submitted.png');
    console.log(`📍 Current URL: ${page.url()}`);

    // Check if OTP step is reached
    const otpInput = await page.$('input[type="password"], input[type="number"], input[placeholder*="OTP"], input[placeholder*="رمز"]');
    if (otpInput) {
      console.log('👉 OTP Step detected! Checking database for generated OTP code...');
      const [users] = await pool.query(
        "SELECT id, phone_number, otp_code, updated_at FROM users WHERE phone_number LIKE ? ORDER BY updated_at DESC LIMIT 1",
        [`%${adminPhone}%`]
      );
      if (users.length > 0 && users[0].otp_code) {
        console.log(`🔑 Retrieved OTP code from DB: ${users[0].otp_code}`);
        await otpInput.type(users[0].otp_code);
        await sleep(1000);
        // Click confirm OTP
        await page.evaluate(() => {
          const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تأكيد') || b.innerText.includes('Confirm'));
          if (btn) btn.click();
        });
        await sleep(4000);
        await page.screenshot({ path: 'admin_dashboard_logged_in.png' });
      }
    }

  } catch(err) {
    console.error('❌ Admin Navigation Error:', err.message);
  } finally {
    await browser.close();
  }

  // Database Checks for Payment Problems and Close Distribution
  console.log('\n===============================================================');
  console.log('🔍 STEP 5: DATABASE DIRECT CHECK FOR PAYMENT PROBLEMS & CLOSE DISTRIBUTION');
  console.log('===============================================================');

  // 1. Check Payment Problems table
  const [paymentProblems] = await pool.query(`
    SELECT 
      pp.id AS problem_id,
      pp.client_order_id,
      co.number AS order_number,
      co.client_order_status,
      pp.tran_ref,
      pp.problem_type,
      pp.created_at
    FROM payment_problems pp
    LEFT JOIN client_orders co ON co.id = pp.client_order_id
    ORDER BY pp.id DESC
    LIMIT 5
  `);

  console.log('📋 Recent Payment Problems in Admin:');
  paymentProblems.forEach(pp => {
    console.log(`  - [Problem ID: ${pp.problem_id}] Order #${pp.order_number || pp.client_order_id} | Status: ${pp.client_order_status} | Reason: ${pp.problem_type}`);
  });

  // 2. Check Orders currently in Close Distribution Queue
  const [closeDistOrders] = await pool.query(`
    SELECT 
      co.id AS order_id,
      co.number AS order_number,
      co.client_order_status,
      co.driver_id,
      co.cost,
      p.name AS package_name,
      p.need_delivery,
      cod.order_detail_status,
      co.created_at
    FROM client_orders co
    JOIN client_order_details cod ON cod.client_order_id = co.id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    WHERE co.client_order_status = 1
      AND co.driver_id IS NULL
      AND (p.need_delivery = 0 OR p.need_delivery IS NULL)
      AND (cod.sale_item_multi_distribution_group_id IS NULL)
      AND cod.order_detail_status != 3
    ORDER BY co.id DESC
    LIMIT 5
  `);

  console.log('\n🎯 Orders Eligible and Active in Close Distribution List:');
  closeDistOrders.forEach(ord => {
    console.log(`  - Order #${ord.order_number} (ID: ${ord.order_id}) | Package: ${ord.package_name} | Cost: ${ord.cost} SAR | Created: ${ord.created_at}`);
  });

  await pool.end();
}

runAdminVerificationFlow();
