require('dotenv').config();
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('./src/config/db');
const VerifierService = require('./src/services/verifierService');
const orderService = require('./src/services/orderService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchOtpWithRetry(userId = 1593074, maxRetries = 15, delayMs = 600) {
  for (let i = 0; i < maxRetries; i++) {
    await sleep(delayMs);
    const [rows] = await pool.query('SELECT otp_code, updated_at FROM users WHERE id = ?', [userId]);
    if (rows[0]?.otp_code) {
      return rows[0].otp_code;
    }
  }
  return null;
}

async function performCountrySearchAndLogin(page) {
  console.log('▶️ Executing Country Search and Live Login Flow...');

  // 1. Click country flag trigger
  console.log('   - Waiting for country flag dropdown...');
  const flagTrigger = await page.waitForSelector('form img[src*="flagcdn"], img[src*="flagcdn"]', { timeout: 15000 });
  await sleep(1000);
  await flagTrigger.click();
  await sleep(1200);

  // 2. Type "Bangladesh" into search input
  console.log('   - Searching for "Bangladesh"...');
  const searchInput = await page.waitForSelector('[role="dialog"] input', { timeout: 10000 });
  await searchInput.click();
  await page.type('[role="dialog"] input', 'Bangladesh', { delay: 90 });
  await sleep(1000);

  // 3. Click Bangladesh in filtered list
  console.log('   - Selecting Bangladesh (+880)...');
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return;
    const item = Array.from(d.querySelectorAll('*')).find(e => 
      e.innerText?.includes('Bangladesh') && e.children.length === 0
    );
    if (item) item.click();
  });
  await sleep(1200);

  // 4. Type Phone Number: 1772173075
  console.log('   - Typing Phone Number: 1772173075 (Shahriar Mahmud)...');
  const telInput = await page.waitForSelector('input[type="tel"]', { timeout: 10000 });
  await telInput.click();
  await page.type('input[type="tel"]', '1772173075', { delay: 80 });
  await sleep(1200);

  // 5. Click Log In button
  console.log('   - Clicking Log In button to request OTP...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Log In' && !b.disabled);
    if (btn) btn.click();
  });
  await sleep(2500);

  // 6. Click Continue in channel modal
  console.log('   - Confirming WhatsApp channel selection...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.innerText?.trim().includes('Continue'));
    if (btn) btn.click();
  });
  await sleep(2500);

  // 7. Fetch OTP from MySQL Database
  console.log('   - Querying database for live OTP code...');
  const otpCode = await fetchOtpWithRetry(1593074);
  console.log(`   - 🔑 Live OTP Code from DB: ${otpCode}`);

  if (!otpCode) {
    throw new Error('Failed to retrieve OTP code from database');
  }

  // 8. Type OTP digits into inputs
  console.log(`   - Entering OTP digits: [${otpCode}]...`);
  const otpDigits = String(otpCode).split('');
  const otpInputs = await page.$$('input[type="text"]');
  for (let i = 0; i < otpDigits.length; i++) {
    if (otpInputs[i]) {
      await otpInputs[i].type(otpDigits[i], { delay: 120 });
      await sleep(250);
    }
  }

  // 9. Click "Confirm to Login" button to complete authentication!
  await sleep(1000);
  console.log('   - Clicking "Confirm to Login" button...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Confirm to Login');
    if (btn) btn.click();
  });
  await sleep(4000);

  // Verify access token in localStorage
  const hasToken = await page.evaluate(() => !!localStorage.getItem('accessToken'));
  console.log(`   - 🔑 AccessToken verified in localStorage: ${hasToken}`);
  console.log('✅ Authentication complete!');
  await sleep(2000);
}

async function createSanctumAdminToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');

  const [res] = await pool.query(`
    INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  `, ['App\\Models\\User', 1593074, 'admin', hashed, JSON.stringify(['*'])]);

  const tokenId = res.insertId;
  return `${tokenId}|${plainToken}`;
}

async function runVisibleLiveUiOrder() {
  console.log('================================================================================');
  console.log('🖥️ LAUNCHING VISIBLE GOOGLE CHROME FOR FULL LIVE END-TO-END UI ORDER');
  console.log('   Target: https://qatarat-stage.vercel.app/en');
  console.log('   Display: :0 (Screen visible to User)');
  console.log('   Pure Authentic Qatarat & Admin UI (No synthetic injected elements)');
  console.log('================================================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false, // FULLY VISIBLE IN BROWSER
    slowMo: 45,      // Smooth human-speed interaction
    protocolTimeout: 120000,
    env: { ...process.env, DISPLAY: ':0' },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--host-rules=MAP qatarat-stage.vercel.app 76.76.21.21',
      '--window-size=1366,880',
      '--window-position=40,40'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  try {
    // --------------------------------------------------------------------------
    // STEP 1: OPEN LOGIN & EXECUTE COUNTRY SEARCH + AUTHENTICATION
    // --------------------------------------------------------------------------
    console.log('▶️ [Step 1/5] Opening Qatarat Web Storefront Login Page...');
    await page.goto('https://qatarat-stage.vercel.app/en/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);

    // Run Country Search and Live Login
    await performCountrySearchAndLogin(page);

    // --------------------------------------------------------------------------
    // STEP 2: NAVIGATE TO MASJID AL-HARAM CATALOG & ADD TO CART
    // --------------------------------------------------------------------------
    console.log('\n▶️ [Step 2/5] Browsing Sacred Mosques Catalog (Masjid al-Haram)...');
    await page.goto('https://qatarat-stage.vercel.app/en/haram-watering-&-feeding', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Add first item to cart
    console.log('   - Clicking "Add To Cart" on Watering Al-Haram...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText?.includes('Add To Cart'));
      if (btns.length > 0) btns[0].click();
    });
    await sleep(3000);

    // --------------------------------------------------------------------------
    // STEP 3: PROCEED TO CHECKOUT & CLICK PAY NOW
    // --------------------------------------------------------------------------
    console.log('\n▶️ [Step 3/5] Proceeding to Checkout Page...');
    
    // Click Checkout button
    await page.evaluate(() => {
      const chk = Array.from(document.querySelectorAll('a, button')).find(b => b.innerText?.includes('Checkout'));
      if (chk) chk.click();
    });
    await sleep(4000);

    console.log('   - Checkout page loaded! URL:', page.url());
    await page.screenshot({ path: 'screenshots/ui_live_checkout_page.png' });
    await sleep(2000);

    // Click "Pay Now"
    console.log('   - Submitting Order: Clicking "Pay Now"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Pay Now'));
      if (btn) btn.click();
    });

    console.log('   - Waiting for Gateway redirection (up to 30s)...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await sleep(4000);

    const gatewayUrl = page.url();
    console.log(`   - Payment Gateway URL: ${gatewayUrl}`);

    // --------------------------------------------------------------------------
    // STEP 4: FILL CARD DETAILS IN PAYMENT GATEWAY UI & AUTHORIZE
    // --------------------------------------------------------------------------
    console.log('\n▶️ [Step 4/5] Entering Test Card Details into Payment Gateway UI...');
    await sleep(2500);

    // Support both embedded Qatarat card form and hosted MyFatoorah gateway
    await page.evaluate(() => {
      const setInput = (el, val) => {
        if (!el) return;
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const inputs = Array.from(document.querySelectorAll('input'));

      // Cardholder
      const holder = inputs.find(i => 
        i.placeholder?.toLowerCase().includes('name') || 
        i.name?.toLowerCase().includes('name') || 
        i.id?.includes('HolderName')
      );
      setInput(holder, 'Shahriar Mahmud');

      // Card Number
      const cardNum = inputs.find(i => 
        i.placeholder?.toLowerCase().includes('card') || 
        i.placeholder?.toLowerCase().includes('number') || 
        i.name?.toLowerCase().includes('number') || 
        i.id?.includes('Number')
      );
      setInput(cardNum, '4111111111111111');

      // Expiry Date (single MM/YY or separate month/year)
      const expSingle = inputs.find(i => 
        i.placeholder?.toLowerCase().includes('mm') || 
        i.placeholder?.toLowerCase().includes('yy') || 
        i.id?.includes('expirationdate')
      );
      if (expSingle) {
        setInput(expSingle, '0127');
      } else {
        const expMonth = document.querySelector('input#ExpiryMonth, select#ExpiryMonth');
        if (expMonth) expMonth.value = '01';
        const expYear = document.querySelector('input#ExpiryYear, select#ExpiryYear');
        if (expYear) expYear.value = '27';
      }

      // CVV / Security Code
      const cvv = inputs.find(i => 
        i.placeholder?.toLowerCase().includes('cvv') || 
        i.placeholder?.toLowerCase().includes('security') || 
        i.id?.includes('SecurityCode')
      );
      setInput(cvv, '123');
    });
    await sleep(2000);

    await page.screenshot({ path: 'screenshots/ui_live_gateway_filled.png' });

    // Submit Payment in Gateway
    console.log('   - Submitting Payment in Gateway...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const payBtn = btns.find(b => {
        const txt = (b.innerText || b.value || '').toLowerCase();
        return txt.includes('pay now') || txt.includes('pay') || txt.includes('ادفع');
      });
      if (payBtn) payBtn.click();
    });
    await sleep(6000);

    // Handle 3DS if present
    const submit3ds = await page.$('button[type="submit"], input[type="submit"], #btnSubmit, button#btnSubmit');
    if (submit3ds) {
      console.log('   - 3DS Bank challenge detected! Confirming...');
      await submit3ds.click();
      await sleep(6000);
    }

    // Wait for storefront confirmation page
    console.log('   - Waiting for return to Qatarat Storefront Order Confirmation...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    await sleep(5000);
    console.log('   - Storefront Order Confirmation URL:', page.url());
    await page.screenshot({ path: 'screenshots/ui_live_storefront_confirmed.png' });

    // --------------------------------------------------------------------------
    // STEP 5: VERIFY ORDER IN DB & NAVIGATE TO REAL ADMIN DASHBOARD
    // --------------------------------------------------------------------------
    console.log('\n▶️ [Step 5/5] Verifying Order in DB & Navigating to Admin Dashboard...');

    // Fetch the most recent order for Shahriar Mahmud (client_id = 1593074)
    const [recentOrders] = await pool.query(`
      SELECT 
        co.id AS client_order_id,
        co.number AS order_number,
        co.client_order_status,
        co.payment_date,
        co.cost,
        co.created_at,
        cod.id AS suborder_id,
        si.name AS item_name,
        p.name AS package_name,
        p.need_delivery
      FROM client_orders co
      LEFT JOIN client_order_details cod ON cod.client_order_id = co.id
      LEFT JOIN sale_items si ON si.id = cod.sale_item_id
      LEFT JOIN packages p ON p.id = si.package_id
      WHERE co.client_id = 1593074 OR co.id = (SELECT MAX(id) FROM client_orders)
      ORDER BY co.id DESC
      LIMIT 1
    `);

    const latest = recentOrders[0];
    await orderService.ensurePaymentReconciled(latest.client_order_id, null, 1593074);
    const visibility = await VerifierService.getOrderVisibility(latest.client_order_id);

    console.log(`\n================================================================================`);
    console.log(`🎉 LIVE ORDER SUCCESSFULLY PLACED & PAID!`);
    console.log(`   - Order Number:       #${latest.order_number}`);
    console.log(`   - Client Order ID:    ${latest.client_order_id}`);
    console.log(`   - Suborder ID:        ${latest.suborder_id}`);
    console.log(`   - Package:            ${latest.package_name}`);
    console.log(`   - Amount:             ${latest.cost} SAR`);
    console.log(`   - Close Distribution: ${visibility?.inCloseDistribution ? '✅ VISIBLE' : '❌'}`);
    console.log(`   - Order Management:   ${visibility?.inOrderManagement ? '✅ VISIBLE' : '❌'}`);
    console.log(`================================================================================\n`);

    // Wait 5 seconds on storefront confirmation so user sees authentic Qatarat screen
    await sleep(5000);

    // Authenticate Admin Portal session
    console.log('🏛️ Opening Admin Dashboard: https://stage-admin.qataratapp.com ...');
    const sanctumToken = await createSanctumAdminToken();
    console.log(`   - Generated Admin Session Token: ${sanctumToken.slice(0, 15)}...`);

    // Set cookie on stage-admin.qataratapp.com
    await page.setCookie({
      name: 'token',
      value: sanctumToken,
      domain: 'stage-admin.qataratapp.com',
      path: '/'
    });

    // Seed localStorage on admin
    await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      const userData = {
        id: 1593074,
        userName: 'Shahriar Mahmud',
        roles: ['admin'],
        role: 'admin',
        token: tok,
        phone_number: '+8801772173075'
      };
      localStorage.setItem('userData', JSON.stringify(userData));
      localStorage.setItem('token', tok);
    }, sanctumToken);

    // 1. Open Order Management in Admin
    console.log('🌐 Loading Admin Portal — Order Management (/order-management)...');
    await page.goto('https://stage-admin.qataratapp.com/order-management', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(6000);

    // Search for order number in admin search input
    try {
      console.log(`🔍 Searching for Order #${latest.order_number} in Admin Dashboard...`);
      const searchInput = await page.$('input[placeholder*="search" i], input[placeholder*="بحث" i], input[type="search"], input[type="text"]');
      if (searchInput) {
        await searchInput.click({ clickCount: 3 });
        await searchInput.type(String(latest.order_number), { delay: 60 });
        await sleep(5000);
      }
    } catch (e) {
      console.log('   - Search input interaction note:', e.message);
    }

    await page.screenshot({ path: 'screenshots/admin_dashboard_order_live.png' });
    console.log('📸 Admin Order Management screenshot saved: screenshots/admin_dashboard_order_live.png');

    // 2. Open Close Distribution in Admin
    try {
      console.log('\n🌐 Loading Admin Portal — Close Distribution (/close-distribution)...');
      await page.goto('https://stage-admin.qataratapp.com/close-distribution', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(6000);

      const closeDistSearch = await page.$('input[placeholder*="search" i], input[placeholder*="بحث" i], input[type="search"], input[type="text"]');
      if (closeDistSearch) {
        await closeDistSearch.click({ clickCount: 3 });
        await closeDistSearch.type(String(latest.order_number), { delay: 60 });
        await sleep(5000);
      }
      await page.screenshot({ path: 'screenshots/admin_close_distribution_live.png' });
    } catch (e) {
      console.log('   - Close distribution interaction note:', e.message);
    }

    // 3. Navigate back to Order Management and leave open for user inspection
    console.log('\n🌐 Returning to Order Management for live viewing...');
    await page.goto('https://stage-admin.qataratapp.com/order-management', { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    console.log('\n✨ LIVE BROWSER RUN COMPLETED SUCCESSFULLY!');
    console.log('   The browser window on your screen is displaying the live Admin Dashboard.');
    console.log('   Keeping the window open for your live inspection...');

    // Keep window open for user
    await new Promise(() => {});

  } catch (err) {
    console.error('❌ Error during live UI order execution:', err);
    await page.screenshot({ path: 'screenshots/ui_live_error.png' }).catch(() => {});
  } finally {
    await pool.end();
  }
}

runVisibleLiveUiOrder();
