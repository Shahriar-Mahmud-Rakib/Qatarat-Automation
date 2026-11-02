const puppeteer = require('puppeteer-core');
const fs = require('fs');
const pool = require('./src/config/db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runLoginTests() {
  console.log('====================================================');
  console.log('🧪 TESTING ADMIN UI: 1. LOGIN (/auth/login)');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const networkLogs = [];
  page.on('request', req => {
    if (req.url().includes('login') || req.url().includes('auth')) {
      networkLogs.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData()
      });
      console.log(`📡 [REQ ${req.method()}] ${req.url()}`);
      if (req.postData()) console.log(`   Body: ${req.postData()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('login') || res.url().includes('auth')) {
      try {
        const text = await res.text();
        console.log(`📡 [RES ${res.status()}] ${res.url()} -> ${text.slice(0, 200)}`);
      } catch (e) {}
    }
  });

  try {
    console.log('1. Navigating to https://stage-admin.qataratapp.com/auth/login ...');
    await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Take screenshot of initial login page
    await page.screenshot({ path: 'screenshots/login_01_initial.png' });

    // Test 1.1: Click country selector -> search "Saudi", "مصر", or "880"
    console.log('\n--- Test 1.1: Country Selector Search ---');
    // Let's inspect country selector element
    const countrySelector = await page.$('.country-selector, [class*="country"], [class*="flag"], button[aria-haspopup="listbox"], .ant-select-selector, [class*="select"]');
    console.log('Country selector element found:', !!countrySelector);

    // Let's dump all clickable / dropdown elements in the phone input container
    const phoneInputHtml = await page.evaluate(() => {
      const form = document.querySelector('form') || document.body;
      return form.innerHTML;
    });
    fs.writeFileSync('screenshots/login_form.html', phoneInputHtml);
    console.log('Saved login form HTML to screenshots/login_form.html');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
    await pool.end();
  }
}

runLoginTests();
