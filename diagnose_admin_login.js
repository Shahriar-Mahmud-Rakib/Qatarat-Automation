const puppeteer = require('puppeteer-core');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('api')) {
      console.log('-> REQ:', req.method(), req.url());
      if (req.postData()) console.log('   Body:', req.postData());
    }
  });

  page.on('response', async res => {
    if (res.url().includes('api')) {
      try {
        const text = await res.text();
        console.log('<- RES:', res.status(), res.url(), text.slice(0, 300));
      } catch(e) {}
    }
  });

  console.log('Navigating to login...');
  await page.goto('https://stage-admin.qataratapp.com/auth/login', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const input = await page.$('input[type="text"], input');
  console.log('Found input:', !!input);
  if (input) {
    await input.click({ clickCount: 3 });
    await input.type('8801772173075');
  }

  await sleep(2000);

  // Check turnstile
  for (const f of page.frames()) {
    if (f.url().includes('cloudflare.com')) {
      console.log('Found cloudflare frame:', f.url());
      const cb = await f.$('#challenge-stage, .ctp-checkbox-label, input');
      if (cb) {
        console.log('Clicking turnstile checkbox...');
        await cb.click();
        await sleep(3000);
      }
    }
  }

  console.log('Submitting login...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('يُقدِّم') || b.innerText.includes('Submit'));
    if (btn) btn.click();
  });

  await sleep(6000);
  await page.screenshot({ path: 'login_step_result.png' });
  console.log('Screenshot saved to login_step_result.png');
  console.log('Current URL:', page.url());

  await browser.close();
}

run();
