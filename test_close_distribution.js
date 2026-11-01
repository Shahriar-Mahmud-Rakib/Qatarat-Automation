require('dotenv').config();
const pool = require('./db');
const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 1. Validate Category and Material Eligibility for Close Distribution
 */
async function getCloseDistributionCategoriesAndItems() {
  console.log('\n======================================================');
  console.log('🔍 STEP 1: CATEGORY & MATERIAL ELIGIBILITY ANALYSIS');
  console.log('======================================================');

  // Query categories (home_page_icons) and their packages
  const [categories] = await pool.query(`
    SELECT id, title, arabic_title, show_package_id, package_order, slug 
    FROM home_page_icons 
    WHERE active = 1
  `);

  console.log('📋 Available Storefront Categories:');
  categories.forEach(cat => {
    console.log(`  - [ID: ${cat.id}] ${cat.title} (${cat.arabic_title}) | Slug: ${cat.slug}`);
  });

  // Query packages and check need_delivery flag
  const [packages] = await pool.query(`
    SELECT p.id, p.name, p.arabic_name, p.need_delivery, p.delivery_fee_included, p.vat_included
    FROM packages p
    WHERE p.active = 1
  `);

  console.log('\n📦 Package Need Delivery Status:');
  const closeDistPackages = [];
  packages.forEach(pkg => {
    const isCloseDist = pkg.need_delivery === 0 || pkg.need_delivery === null;
    const badge = isCloseDist ? '✅ CLOSE DISTRIBUTION (Need Delivery: OFF)' : '❌ DRIVER ASSIGNED (Need Delivery: ON)';
    console.log(`  - [ID: ${pkg.id}] ${pkg.name || 'N/A'} (${pkg.arabic_name || 'N/A'}) => ${badge}`);
    if (isCloseDist) closeDistPackages.push(pkg);
  });

  // Query sale items with distribution type
  const [items] = await pool.query(`
    SELECT 
      si.id AS sale_item_id, 
      si.name AS item_name, 
      p.id AS package_id, 
      p.name AS package_name,
      smdg.id AS smdg_id,
      smdg.initial_days
    FROM sale_items si
    JOIN packages p ON si.package_id = p.id
    LEFT JOIN sale_item_multi_distribution_groups smdg ON smdg.sale_item_id = si.id
    WHERE si.active = 1 AND (p.need_delivery = 0 OR p.need_delivery IS NULL)
    LIMIT 10
  `);

  console.log('\n💧 Close Distribution Eligible Items (One-Time Distribution):');
  items.forEach(it => {
    const distType = it.smdg_id ? `MULTI_TIME (${it.initial_days} Days)` : 'ONE_TIME_DISTRIBUTION (✅ Direct Close)';
    console.log(`  - [Item ID: ${it.sale_item_id}] ${it.item_name || 'Standard'} (Package: ${it.package_name}) => Type: ${distType}`);
  });

  return { categories, packages: closeDistPackages, items };
}

/**
 * 2. Automated Web App Browser Flow (Puppeteer)
 */
async function runWebBrowserFlow() {
  console.log('\n======================================================');
  console.log('🌐 STEP 2: BROWSER AUTOMATION — ORDERING FLOW');
  console.log('======================================================');

  let browser;
  try {
    console.log('🚀 Launching Google Chrome...');
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const targetUrl = 'https://qataratapp.com/en';
    console.log(`🌍 Navigating to ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    const pageTitle = await page.title();
    console.log(`✅ Page loaded: "${pageTitle}"`);

    // Category Selection: Masjid al-Haram (Haram Watering & Feeding) or Mecca Mosques Most Needed
    console.log('👉 Selecting category for Close Distribution (Masjid al-Haram / Haram Watering & Feeding)...');
    
    const categoryClicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
      const target = candidates.find(el => {
        const txt = (el.innerText || '').toLowerCase();
        return txt.includes('masjid al-haram') || txt.includes('haram watering') || txt.includes('most needed');
      });
      if (target) {
        target.click();
        return target.innerText.trim();
      }
      return null;
    });

    if (categoryClicked) {
      console.log(`✅ Clicked category card: "${categoryClicked}"`);
    } else {
      console.log('⚠️ Category card not found by text, navigating directly to /en/haram-watering-&-feeding...');
      await page.goto('https://qataratapp.com/en/haram-watering-&-feeding', { waitUntil: 'networkidle2' });
    }

    await sleep(3000);
    console.log(`📍 Current Page URL: ${page.url()}`);

    // Take screenshot of category items
    await page.screenshot({ path: 'step2_category_selected.png' });
    console.log('📸 Screenshot saved: step2_category_selected.png');

    // Check available packages and cartons/bottles
    const productOptions = await page.evaluate(() => {
      const options = [];
      document.querySelectorAll('button, div[role="radio"], label').forEach(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        if (text && text.length < 50 && (text.includes('Carton') || text.includes('Bottle') || text.includes('SAR') || text.includes('Meal') || text.includes('Water'))) {
          options.push(text);
        }
      });
      return options;
    });

    console.log('📦 Available Bottle/Package Options on UI:');
    productOptions.forEach((opt, idx) => console.log(`   ${idx + 1}. ${opt}`));

  } catch (err) {
    console.error('⚠️ Browser automation note:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * 3. Verify Close Distribution in Database & Admin Backend Rules
 */
async function verifyCloseDistributionStatus(targetOrderNumber = null) {
  console.log('\n======================================================');
  console.log('🔍 STEP 3: CLOSE DISTRIBUTION BACKEND & DB VERIFICATION');
  console.log('======================================================');

  let queryWhere = '';
  const params = [];
  if (targetOrderNumber) {
    queryWhere = 'WHERE co.number = ?';
    params.push(targetOrderNumber);
  } else {
    queryWhere = `
      WHERE (p.need_delivery = 0 OR p.need_delivery IS NULL)
        AND (cod.sale_item_multi_distribution_group_id IS NULL)
      ORDER BY co.id DESC
      LIMIT 5
    `;
  }

  const query = `
    SELECT 
      co.id AS order_id,
      co.number AS order_number,
      co.client_order_status,
      co.driver_id,
      co.cost,
      co.created_at,
      p.id AS package_id,
      p.name AS package_name,
      p.need_delivery,
      cod.id AS order_detail_id,
      cod.sale_item_id,
      cod.quantity,
      cod.order_detail_status,
      cod.sale_item_multi_distribution_group_id
    FROM client_orders co
    JOIN client_order_details cod ON cod.client_order_id = co.id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    ${queryWhere}
  `;

  const [orders] = await pool.query(query, params);

  console.log(`📊 Found ${orders.length} Order(s) evaluated against Close Distribution Rules:\n`);

  for (const order of orders) {
    console.log(`------------------------------------------------------`);
    console.log(`🧾 Order #${order.order_number} (ID: ${order.order_id}) - Package: "${order.package_name}"`);
    console.log(`------------------------------------------------------`);

    // Checklist Evaluation:
    // Rule 1: Payment Status
    const isPaymentReceived = order.client_order_status === 1;
    const rule1 = isPaymentReceived
      ? '✅ PASSED: Status = Payment Received (1)'
      : `❌ FAILED: Status is ${order.client_order_status} (Must be Payment Received / 1)`;

    // Rule 2: Driver Assignment
    const noDriverAssigned = order.driver_id === null;
    const rule2 = noDriverAssigned
      ? '✅ PASSED: No Driver Assigned (driver_id IS NULL)'
      : `❌ FAILED: Driver assigned (driver_id: ${order.driver_id}) - Routed to Set Orders!`;

    // Rule 3: Need Delivery Flag
    const needDeliveryOff = order.need_delivery === 0 || order.need_delivery === null;
    const rule3 = needDeliveryOff
      ? '✅ PASSED: Need Delivery = 0 (Charity/Bulk Mosque Distribution)'
      : `❌ FAILED: Need Delivery = 1 (Package requires physical driver delivery)`;

    // Rule 4: Distribution Type
    const isOneTimeDist = order.sale_item_multi_distribution_group_id === null;
    const rule4 = isOneTimeDist
      ? '✅ PASSED: Type = ONE_TIME_DISTRIBUTION (Direct Close)'
      : `❌ FAILED: Type = MULTI_TIME_DISTRIBUTION (Routed to Multi-Distribution module)`;

    // Rule 5: Suborder pending
    const isPendingClose = order.order_detail_status !== 3; // 3 is usually Delivered/Completed
    const rule5 = isPendingClose
      ? '✅ PASSED: Order Detail is Pending Distribution'
      : 'ℹ️ ALREADY CLOSED: Proof uploaded and order marked Delivered';

    console.log(`  1. Payment Status:    ${rule1}`);
    console.log(`  2. Driver Routing:    ${rule2}`);
    console.log(`  3. Package Config:    ${rule3}`);
    console.log(`  4. Distribution Type: ${rule4}`);
    console.log(`  5. Execution State:   ${rule5}`);

    const isEligible = isPaymentReceived && noDriverAssigned && needDeliveryOff && isOneTimeDist && isPendingClose;
    console.log(`\n  🎯 RESULT: ${isEligible ? '🎉 ELIGIBLE FOR CLOSE DISTRIBUTION LIST' : '⛔ NOT VISIBLE IN CLOSE DISTRIBUTION LIST'}`);
    console.log(`------------------------------------------------------\n`);
  }
}

/**
 * 4. Admin User Check (8801772173075)
 */
async function checkAdminUser() {
  console.log('\n======================================================');
  console.log('👤 STEP 4: ADMIN USER & PERMISSION VERIFICATION');
  console.log('======================================================');

  const adminPhone = process.env.ADMIN_PHONE || '8801772173075';
  const [users] = await pool.query(
    'SELECT id, name, username, email, phone_number, role FROM users WHERE phone_number LIKE ? OR username LIKE ?',
    [`%${adminPhone}%`, `%${adminPhone}%`]
  );

  console.log(`Admin Search for Phone: ${adminPhone}`);
  if (users.length > 0) {
    users.forEach(u => {
      console.log(`  - User ID: ${u.id} | Name: ${u.name || 'N/A'} | Role: ${u.role} | Phone: ${u.phone_number}`);
    });
    const hasAdminRole = users.some(u => u.role === 'admin' || u.role === 'superadmin');
    console.log(`  🔐 Admin Access Status: ${hasAdminRole ? '✅ Confirmed Admin Privileges' : '⚠️ User role is not admin'}`);
  } else {
    console.log('  ⚠️ User not found in database.');
  }
}

async function runFullTest() {
  const targetOrderNumber = process.argv[2] || null;
  if (targetOrderNumber) {
    console.log(`🎯 Testing specific Order Number: ${targetOrderNumber}`);
  }

  try {
    await getCloseDistributionCategoriesAndItems();
    if (!targetOrderNumber) {
      await runWebBrowserFlow();
    }
    await verifyCloseDistributionStatus(targetOrderNumber);
    await checkAdminUser();
    console.log('\n✅ AUTOMATION TEST & VERIFICATION COMPLETED.');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

runFullTest();
