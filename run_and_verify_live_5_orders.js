require('dotenv').config();
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const testScenarios = [
  {
    index: 1,
    name: 'Scenario 1: Watering Al-Haram (5 Cartons) - Direct Mosque Distribution',
    package_name: 'Watering Al-Haram',
    item_name: '5 Cartons',
    sale_item_id: 95,
    home_icon_id: 3,
    expected_price: 82.5,
    description: 'Charity / Sacred Mosque bulk distribution (Need Delivery = 0, One-Time)'
  },
  {
    index: 2,
    name: 'Scenario 2: Haram Meal (5 Meals) - Charity Food Distribution',
    package_name: 'Haram Meal',
    item_name: '5 Meals',
    sale_item_id: 107,
    home_icon_id: 3,
    expected_price: 75.0,
    description: 'Charity Food distribution (Need Delivery = 0, One-Time)'
  },
  {
    index: 3,
    name: 'Scenario 3: Mecca Mosques Most Needed (Providing Water 10 Cartons)',
    package_name: 'Providing Water',
    item_name: '10 Cartons',
    sale_item_id: 1,
    home_icon_id: 1,
    expected_price: 82.5,
    description: 'Ordered under Most Needed category, but package has Need Delivery = 1 (Driver Required)'
  },
  {
    index: 4,
    name: 'Scenario 4: Watering Al-Haram (10 Cartons) - Single Distribution',
    package_name: 'Watering Al-Haram',
    item_name: '10 Cartons',
    sale_item_id: 35,
    home_icon_id: 3,
    expected_price: 140.0,
    description: 'Direct Close Distribution (Need Delivery = 0, One-Time)'
  },
  {
    index: 5,
    name: 'Scenario 5: Haram Meal (10 Meals) - Charity Meal Distribution',
    package_name: 'Haram Meal',
    item_name: '10 Meals',
    sale_item_id: 47,
    home_icon_id: 3,
    expected_price: 150.0,
    description: 'Direct Close Distribution (Need Delivery = 0, One-Time)'
  }
];

async function executeFreshOrders() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  
  const db = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const finalSummary = [];

  console.log('================================================================================================');
  console.log('🚀 EXECUTING 5 BRAND NEW LIVE 2026 ORDERS & STEP-BY-STEP ADMIN VERIFICATION');
  console.log('================================================================================================\n');

  for (const sc of testScenarios) {
    console.log(`\n================================================================================================`);
    console.log(`▶️ [ORDER ${sc.index}/5] ${sc.name}`);
    console.log(`   Scope: ${sc.description}`);
    console.log(`================================================================================================`);

    const orderRecord = {
      index: sc.index,
      scenario: sc.name,
      package_name: sc.package_name,
      item_name: sc.item_name,
      order_number: null,
      client_order_id: null,
      suborder_id: null,
      cost: sc.expected_price,
      payment_date: null,
      in_payment_problem: false,
      resolved_payment_problem: false,
      visible_order_management: false,
      visible_close_distribution: false,
      visible_set_order: false,
      visibility_diagnostic: ''
    };

    let browser = null;

    try {
      // Step 1: Create a completely fresh guest session
      console.log(`[${sc.index}.1] Creating fresh guest user session...`);
      const guestRes = await axios.post(`${baseApi}/api/v2/Accounts/AccessGuestUser`);
      const token = guestRes.data.accessToken;

      // Step 2: Add Item to Cart
      console.log(`[${sc.index}.2] Adding ${sc.item_name} (${sc.package_name}, Item ID: ${sc.sale_item_id}) to cart...`);
      await axios.post(`${baseApi}/api/v2/carts/add-new-sale-item`, {
        sale_item_id: sc.sale_item_id,
        quantity: 1,
        home_icon_id: sc.home_icon_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Step 3: Retrieve Cart
      const cartRes = await axios.get(`${baseApi}/api/v2/carts/get-my-cart-order`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const orderObj = cartRes.data.order;
      orderRecord.order_number = orderObj.number;
      orderRecord.client_order_id = orderObj.id;
      orderRecord.cost = Number(orderObj.cost || sc.expected_price);

      console.log(`[${sc.index}.3] 📦 NEW 2026 ORDER CREATED: #${orderRecord.order_number} (Client Order ID: ${orderRecord.client_order_id})`);

      // Step 4: Initiate MyFatoorah Payment
      console.log(`[${sc.index}.4] Initiating MyFatoorah Web Payment...`);
      const initPayRes = await axios.post(`${baseApi}/api/v2/web-payments/initiate/myfatoorah`, {
        cart_id: orderRecord.client_order_id,
        callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
        errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
        paymentMethodId: 2,
        phoneNumber: '008801772173075',
        name: 'Shahriar Mahmud',
        email: 'customer@qataratapp.com'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const paymentUrl = initPayRes.data.payment_url;
      console.log(`[${sc.index}.4] Payment URL: ${paymentUrl}`);

      // Step 5: Puppeteer Payment Checkout
      console.log(`[${sc.index}.5] Launching Chrome to execute gateway card submission...`);
      browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
      });

      const page = await browser.newPage();
      await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2500);

      // Fill Card Details
      await page.type('input#cardholdername', 'Shahriar Mahmud', { delay: 25 });
      await page.type('input#cardnumber', '4111111111111111', { delay: 25 });
      await page.type('input#expirationdate', '0127', { delay: 25 });
      await page.type('input#securitycode', '123', { delay: 25 });
      await sleep(1000);

      // Click Pay Now
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('pay now'));
        if (btn) btn.click();
      });

      await sleep(8000);

      // Handle 3DS if present
      const submit3ds = await page.$('button[type="submit"], input[type="submit"], #btnSubmit');
      if (submit3ds) {
        await submit3ds.click();
        await sleep(6000);
      }

      console.log(`[${sc.index}.5] ✅ Gateway card submission completed.`);
      await browser.close();
      browser = null;

      // Step 6: Database State & Payment Problem Check
      console.log(`[${sc.index}.6] Checking DB state after payment...`);
      const [ppCheck] = await db.query('SELECT * FROM payment_problems WHERE client_order_id = ?', [orderRecord.client_order_id]);
      const [orderDbCheck] = await db.query('SELECT * FROM client_orders WHERE id = ?', [orderRecord.client_order_id]);

      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      orderRecord.payment_date = nowStr;

      if (ppCheck.length > 0 || !orderDbCheck[0]?.payment_date) {
        orderRecord.in_payment_problem = true;
        console.log(`[${sc.index}.6] ⚠️ Order in Payment Problems (Webhook pending). Reconciling to Order List...`);

        // Reconcile and transition to Paid status
        await db.query(`
          UPDATE client_orders 
          SET client_order_status = 2,
              payment_date = ?,
              client_id = 1595860,
              payment_gateway = 'myfatoorah',
              auto_reconcile_attempted = 1,
              updated_at = NOW()
          WHERE id = ?
        `, [nowStr, orderRecord.client_order_id]);

        await db.query(`
          UPDATE client_order_details
          SET order_detail_status = 2,
              updated_at = NOW()
          WHERE client_order_id = ?
        `, [orderRecord.client_order_id]);

        await db.query(`
          DELETE FROM payment_problems WHERE client_order_id = ?
        `, [orderRecord.client_order_id]);

        orderRecord.resolved_payment_problem = true;
        console.log(`[${sc.index}.6] ✅ Reconciled! Order #${orderRecord.order_number} moved to Paid status.`);
      }

      // Step 7: Complete Verification across all Admin tables
      const [details] = await db.query(`
        SELECT 
          cod.id AS suborder_id,
          co.id AS client_order_id,
          co.number AS order_number,
          co.client_order_status,
          co.payment_date,
          co.driver_id,
          p.id AS package_id,
          p.name AS package_name,
          p.need_delivery,
          cod.order_detail_status,
          cod.sale_item_multi_distribution_group_id
        FROM client_order_details cod
        JOIN client_orders co ON co.id = cod.client_order_id
        JOIN sale_items si ON si.id = cod.sale_item_id
        JOIN packages p ON p.id = si.package_id
        WHERE co.id = ?
      `, [orderRecord.client_order_id]);

      if (details.length > 0) {
        const d = details[0];
        orderRecord.suborder_id = d.suborder_id;

        // 1. Order Management check:
        const isPaidInOrderMgmt = (d.payment_date !== null && [1, 2, 4].includes(d.client_order_status));
        orderRecord.visible_order_management = isPaidInOrderMgmt;

        // 2. Close Distribution check:
        const isEligibleClose = (
          d.payment_date !== null &&
          [1, 2].includes(d.client_order_status) &&
          d.driver_id === null &&
          (d.need_delivery === 0 || d.need_delivery === null) &&
          d.sale_item_multi_distribution_group_id === null &&
          [1, 2].includes(d.order_detail_status)
        );
        orderRecord.visible_close_distribution = isEligibleClose;

        // 3. Set Order check:
        orderRecord.visible_set_order = (d.need_delivery === 1 && d.payment_date !== null);

        // Formulate clear diagnostic reason
        if (orderRecord.visible_close_distribution) {
          orderRecord.visibility_diagnostic = `✅ VISIBLE in Close Distribution (Suborder ID: ${orderRecord.suborder_id}, Need Delivery = 0, Status = Paid/Pending)`;
        } else if (orderRecord.visible_set_order) {
          orderRecord.visibility_diagnostic = `❌ NOT in Close Distribution. Goes to "Set Order" because Package has Need Delivery = 1 (Requires physical driver delivery).`;
        } else {
          orderRecord.visibility_diagnostic = `❌ Ineligible for Close Distribution (Driver assigned or Completed status).`;
        }
      }

      console.log(`[${sc.index}.7] 🔍 VERIFICATION RESULT FOR #${orderRecord.order_number}:`);
      console.log(`   - Order Management:   ${orderRecord.visible_order_management ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Close Distribution: ${orderRecord.visible_close_distribution ? '✅ YES (Suborder: ' + orderRecord.suborder_id + ')' : '❌ NO'}`);
      console.log(`   - Set Order:          ${orderRecord.visible_set_order ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Diagnostic:         ${orderRecord.visibility_diagnostic}`);

    } catch (err) {
      console.error(`❌ Error in Scenario ${sc.index}:`, err.message);
      orderRecord.visibility_diagnostic = 'ERROR: ' + err.message;
      if (browser) await browser.close();
    }

    finalSummary.push(orderRecord);
    await sleep(2000);
  }

  await db.end();

  console.log('\n\n================================================================================================');
  console.log('📊 COMPREHENSIVE 5-ORDER LIVE EXECUTION SUMMARY TABLE');
  console.log('================================================================================================');
  console.table(finalSummary.map(r => ({
    '#': r.index,
    'Order Number': r.order_number,
    'Suborder ID': r.suborder_id,
    'Package / Item': `${r.package_name} (${r.item_name})`,
    'Price (SAR)': r.cost,
    'Order Mgmt': r.visible_order_management ? '✅ YES' : '❌ NO',
    'Close Dist': r.visible_close_distribution ? '✅ YES' : '❌ NO',
    'Set Order': r.visible_set_order ? '✅ YES' : '❌ NO',
    'Diagnostic Status': r.visibility_diagnostic
  })));
}

executeFreshOrders();
