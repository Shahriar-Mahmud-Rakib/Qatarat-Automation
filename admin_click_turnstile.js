const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  let bearerToken = null;

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/admin/v2/')) {
      console.log(`📡 [Admin API ${res.status()}] ${url.split('?')[0]}`);
      try {
        const json = await res.json();
        console.log('   Data:', JSON.stringify(json).slice(0, 150));
      } catch(e) {}
    }
  });

  console.log('1. Navigating to login...');
  await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const input = await page.$('input');
  if (input) {
    await input.click({ clickCount: 3 });
    await input.type('8801772173075');
  }
  await sleep(2000);

  // Find Turnstile iframe
  const iframeHandle = await page.$('iframe[src*="challenges.cloudflare.com"]');
  if (iframeHandle) {
    const box = await iframeHandle.boundingBox();
    console.log('Iframe box:', box);
    if (box) {
      // Click checkbox
      await page.mouse.click(box.x + 30, box.y + box.height / 2);
      console.log('Clicked Turnstile checkbox!');
      await sleep(4000);
    }
  }

  await page.screenshot({ path: 'after_turnstile_click.png' });

  // Click Submit
  const isEnabled = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم'));
    if (btn) {
      btn.click();
      return 'CLICKED: ' + btn.innerText;
    }
    return 'NO_BTN';
  });
  console.log('Button state:', isEnabled);

  await sleep(5000);
  await page.screenshot({ path: 'after_submit_attempt.png' });

  // Check if OTP input is now present
  const otpInput = await page.$('input[type="password"], input[type="text"], input');
  console.log('OTP Input found:', !!otpInput);

  // Check DB for OTP
  const conn = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const [users] = await conn.query('SELECT id, phone_number, otp_code, updated_at FROM users WHERE phone_number LIKE "%8801772173075%" ORDER BY updated_at DESC');
  console.log('Users in DB after submit:', users);

  await conn.end();
  await browser.close();
}

run();
