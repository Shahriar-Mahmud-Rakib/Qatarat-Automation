const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/admin/v2/')) {
      console.log(`📡 [Admin API ${res.status()}] ${url.split('?')[0]}`);
      try {
        const text = await res.text();
        console.log('   Response snippet:', text.slice(0, 150));
      } catch(e) {}
    }
  });

  console.log('1. Navigating to login...');
  await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const phoneInput = await page.$('input[type="text"], input');
  if (phoneInput) {
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type('8801772173075');
  }
  await sleep(2000);

  // Turnstile solving
  const frames = page.frames();
  const cfFrame = frames.find(f => f.url().includes('cloudflare.com'));
  if (cfFrame) {
    console.log('Found CF frame:', cfFrame.url());
    const label = await cfFrame.$('#challenge-stage, .ctp-checkbox-label, input, label, div');
    if (label) {
      console.log('Clicking inside CF frame...');
      await label.click();
    }
  }

  // Also try clicking coordinate of turnstile widget
  const iframeHandle = await page.$('iframe[src*="challenges.cloudflare.com"]');
  if (iframeHandle) {
    const box = await iframeHandle.boundingBox();
    if (box) {
      await page.mouse.click(box.x + 28, box.y + 32);
    }
  }

  await sleep(4000);
  await page.screenshot({ path: 'stealth_turnstile.png' });

  // Submit
  const submitRes = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم'));
    if (btn) {
      const isDisabled = btn.disabled || btn.classList.contains('v-btn--disabled') || btn.getAttribute('aria-disabled') === 'true';
      if (!isDisabled) {
        btn.click();
        return 'SUBMITTED';
      }
      return 'DISABLED';
    }
    return 'NOT_FOUND';
  });

  console.log('Submit button status:', submitRes);
  await sleep(5000);
  await page.screenshot({ path: 'stealth_after_submit.png' });

  // Check if OTP input is rendered
  const otpInput = await page.$('input[type="password"], input[type="text"], input');
  console.log('OTP Input present:', !!otpInput);

  await browser.close();
}

run();
