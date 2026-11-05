const puppeteer = require('puppeteer-core');
const pool = require('./src/config/db');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  const networkEvents = [];
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('cart') || req.url().includes('checkout') || req.url().includes('Account') || req.url().includes('login')) {
      networkEvents.push({ 
        type: 'REQ', 
        method: req.method(), 
        url: req.url(), 
        auth: !!req.headers()['authorization']
      });
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/') || res.url().includes('cart') || res.url().includes('checkout') || res.url().includes('Account') || res.url().includes('login')) {
      try {
        const text = await res.text();
        networkEvents.push({ type: 'RES', status: res.status(), url: res.url(), body: text.slice(0, 300) });
      } catch (e) {}
    }
  });

  page.on('console', msg => {
    if (msg.text().includes('auth') || msg.text().includes('token') || msg.text().includes('user') || msg.type() === 'error') {
      console.log('[Browser Console]', msg.type(), msg.text());
    }
  });

  console.log('1. Navigating to login page...');
  await page.goto('https://qatarat-stage.vercel.app/en/login', { waitUntil: 'networkidle2' });
  await page.click('form img[src*="flagcdn"], img[src*="flagcdn"]');
  await new Promise(r => setTimeout(r, 800));
  await page.type('[role="dialog"] input', 'Bangladesh');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const item = Array.from(d.querySelectorAll('*')).find(e => e.innerText?.includes('Bangladesh') && e.children.length === 0);
    if (item) item.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.type('input[type="tel"]', '1772173075');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Log In');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.innerText?.trim().includes('Continue'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  const [rows] = await pool.query('SELECT otp_code FROM users WHERE id = 1593074');
  const otpCode = rows[0]?.otp_code;
  console.log('2. Got OTP from DB:', otpCode);

  const otpDigits = String(otpCode).split('');
  const otpInputs = await page.$$('input[type="text"]');
  for (let i = 0; i < otpDigits.length; i++) {
    if (otpInputs[i]) await otpInputs[i].type(otpDigits[i]);
  }

  await new Promise(r => setTimeout(r, 4000));
  console.log('3. URL after submitting OTP:', page.url());

  // Check storage and cookies
  const storageAfterLogin = await page.evaluate(() => ({
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage }
  }));
  const cookiesAfterLogin = await page.cookies();
  console.log('4. LocalStorage keys after login:', Object.keys(storageAfterLogin.localStorage));
  console.log('   LocalStorage content:', JSON.stringify(storageAfterLogin.localStorage, null, 2));
  console.log('   Cookies after login:', cookiesAfterLogin.map(c => ({ name: c.name, domain: c.domain, path: c.path, value: c.value.slice(0, 30) })));

  // Now go to /en/haram-watering-&-feeding
  console.log('5. Navigating to catalog...');
  await page.goto('https://qatarat-stage.vercel.app/en/haram-watering-&-feeding', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText?.includes('Add To Cart'));
    if (btns.length > 0) btns[0].click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Click Checkout
  console.log('6. Clicking Checkout...');
  await page.evaluate(() => {
    const chk = Array.from(document.querySelectorAll('a, button')).find(b => b.innerText?.includes('Checkout'));
    if (chk) chk.click();
  });
  await new Promise(r => setTimeout(r, 4000));
  console.log('7. After clicking Checkout, URL is:', page.url());

  // Check if login dialog exists on checkout
  const checkoutDialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"], modal, .modal');
    return d ? d.innerText.slice(0, 300) : null;
  });
  console.log('8. Dialog visible on checkout page:', checkoutDialog);

  // Now click Pay Now
  console.log('9. Clicking Pay Now on checkout...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Pay Now'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  const afterPayNowDialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"], modal, .modal');
    return d ? d.innerText.slice(0, 300) : null;
  });
  console.log('10. Dialog visible after clicking Pay Now:', afterPayNowDialog);

  console.log('\n--- Relevant Network Requests Captured ---');
  for (const n of networkEvents) {
    if (n.type === 'REQ') console.log(`REQ: ${n.method} ${n.url} [Has Auth Header: ${n.auth}]`);
    if (n.type === 'RES') console.log(`RES: ${n.status} ${n.url} -> ${n.body.slice(0, 120)}`);
  }

  await browser.close();
  await pool.end();
})();
