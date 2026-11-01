require('dotenv').config();
const puppeteer = require('puppeteer-core');
const pool = require('./db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runStageOrderFlow() {
  console.log('===============================================================');
  console.log('🚀 RUNNING STAGE ORDER AUTOMATION (Qatarat Stage Vercel)');
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

  let createdOrderNumber = null;
  let cartId = null;

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/v2/')) {
      try {
        const data = await res.json();
        if (url.includes('cart') || url.includes('order') || url.includes('payment')) {
          console.log(`📡 [API ${res.status()}] ${url.split('?')[0]}`);
          if (data && data.orderNumber) {
            createdOrderNumber = data.orderNumber;
            console.log(`🎯 Detected Created Order Number: ${createdOrderNumber}`);
          }
          if (data && data.number) {
            createdOrderNumber = data.number;
            console.log(`🎯 Detected Created Order Number: ${createdOrderNumber}`);
          }
        }
      } catch (e) {}
    }
  });

  try {
    // 1. Navigate to Staging Web App
    console.log('\n📍 Step 1: Navigating to https://qatarat-stage.vercel.app/en ...');
    await page.goto('https://qatarat-stage.vercel.app/en', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.screenshot({ path: 'stage_step1_home.png' });
    console.log('📸 Screenshot saved: stage_step1_home.png');

    // 2. Select Close Distribution Category (Masjid al-Haram)
    console.log('\n📍 Step 2: Selecting Close Distribution Category (Masjid al-Haram)...');
    const categoryLink = await page.$('a[href*="haram-watering-&-feeding"]');
    if (categoryLink) {
      await categoryLink.click();
    } else {
      await page.goto('https://qatarat-stage.vercel.app/en/haram-watering-&-feeding', { waitUntil: 'networkidle2' });
    }
    await sleep(3000);
    await page.screenshot({ path: 'stage_step2_category.png' });
    console.log(`📍 Landed on: ${page.url()}`);
    console.log('📸 Screenshot saved: stage_step2_category.png');

    // 3. Select Package / Bottle option
    console.log('\n📍 Step 3: Selecting bottle / package item...');
    const buttons = await page.$$('button');
    let addBtnFound = false;

    // Look for add to cart or carton selector
    const clickedItem = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, div[role="radio"], div[role="button"]'));
      // Find package/item selector
      const itemBtn = allButtons.find(b => {
        const txt = (b.innerText || '').toLowerCase();
        return txt.includes('carton') || txt.includes('bottle') || txt.includes('sar') || txt.includes('water');
      });
      if (itemBtn) {
        itemBtn.click();
        return itemBtn.innerText.trim();
      }
      return null;
    });

    console.log(`👉 Clicked package option: "${clickedItem || 'Default Option'}"`);
    await sleep(2000);

    // Click Add to Cart / Checkout button
    console.log('\n📍 Step 4: Adding to cart and proceeding...');
    const checkoutClicked = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      const addBtn = allButtons.find(b => {
        const txt = (b.innerText || '').toLowerCase();
        return txt.includes('cart') || txt.includes('checkout') || txt.includes('continue') || txt.includes('next') || txt.includes('order');
      });
      if (addBtn) {
        addBtn.click();
        return addBtn.innerText.trim();
      }
      return null;
    });

    console.log(`👉 Action Button Clicked: "${checkoutClicked || 'None'}"`);
    await sleep(3000);
    await page.screenshot({ path: 'stage_step3_cart.png' });
    console.log('📸 Screenshot saved: stage_step3_cart.png');

    // If redirected or modal opened, check checkout URL
    console.log(`📍 Current URL: ${page.url()}`);

    // Navigate to checkout directly if needed
    if (!page.url().includes('checkout')) {
      console.log('👉 Navigating to checkout page: https://qatarat-stage.vercel.app/en/checkout');
      await page.goto('https://qatarat-stage.vercel.app/en/checkout', { waitUntil: 'networkidle2' });
      await sleep(3000);
    }

    await page.screenshot({ path: 'stage_step4_checkout.png' });
    console.log('📸 Screenshot saved: stage_step4_checkout.png');

    // Inspect inputs on checkout
    const checkoutFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, button')).map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        value: el.value,
        text: el.innerText ? el.innerText.trim() : ''
      }));
    });

    console.log('📋 Checkout Inputs & Buttons detected:', checkoutFields);

  } catch (err) {
    console.error('❌ Stage Automation Error:', err.message);
  } finally {
    await browser.close();
  }

  // 5. Database Verification
  console.log('\n===============================================================');
  console.log('🔍 STEP 5: VERIFYING RECENT STAGING ORDERS IN DATABASE');
  console.log('===============================================================');

  const [recentOrders] = await pool.query(`
    SELECT 
      co.id AS order_id,
      co.number AS order_number,
      co.client_order_status,
      co.driver_id,
      co.cost,
      co.payment_gateway,
      co.created_at,
      p.id AS package_id,
      p.name AS package_name,
      p.need_delivery,
      cod.sale_item_id,
      cod.order_detail_status,
      cod.sale_item_multi_distribution_group_id
    FROM client_orders co
    JOIN client_order_details cod ON cod.client_order_id = co.id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    WHERE (p.need_delivery = 0 OR p.need_delivery IS NULL)
    ORDER BY co.id DESC
    LIMIT 3
  `);

  console.log('📊 Recent Close Distribution Orders in Database:');
  recentOrders.forEach((ord, idx) => {
    console.log(`\n--- [Order ${idx + 1}] #${ord.order_number} (ID: ${ord.order_id}) ---`);
    console.log(`  Package:          ${ord.package_name} (Need Delivery: ${ord.need_delivery})`);
    console.log(`  Cost:             ${ord.cost} SAR | Gateway: ${ord.payment_gateway || 'N/A'}`);
    console.log(`  Payment Status:   ${ord.client_order_status === 1 ? '✅ Payment Received (1)' : '⏳ Pending / Other'}`);
    console.log(`  Driver Assigned:  ${ord.driver_id === null ? '✅ None (driver_id is NULL)' : `❌ Assigned to Driver ${ord.driver_id}`}`);
    console.log(`  Distribution:     ${ord.sale_item_multi_distribution_group_id === null ? '✅ ONE_TIME_DISTRIBUTION' : '❌ MULTI_TIME'}`);
    console.log(`  Close Visibility: ${ord.client_order_status === 1 && ord.driver_id === null && (ord.need_delivery === 0 || ord.need_delivery === null) && ord.sale_item_multi_distribution_group_id === null ? '🎉 ACTIVE IN CLOSE DISTRIBUTION LIST' : '⛔ INELIGIBLE'}`);
  });

  await pool.end();
}

runStageOrderFlow();
