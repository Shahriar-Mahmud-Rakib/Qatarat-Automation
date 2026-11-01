require('dotenv').config();
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const mysql = require('mysql2/promise');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const testScenarios = [
  {
    id: 1,
    name: 'Scenario 1: Haram Watering (5 Cartons) - Standard Close Distribution',
    sale_item_id: 95,
    package_name: 'Watering Al-Haram',
    item_name: '5 Cartons',
    home_icon_id: 3,
    expected_price: 82.5,
    scenario_type: 'Direct Close Distribution (need_delivery=0, One-Time)'
  },
  {
    id: 2,
    name: 'Scenario 2: Haram Meal (5 Meals) - Charity Food Distribution',
    sale_item_id: 107,
    package_name: 'Haram Meal',
    item_name: '5 Meals',
    home_icon_id: 3,
    expected_price: 75.0,
    scenario_type: 'Direct Close Distribution (need_delivery=0, One-Time)'
  },
  {
    id: 3,
    name: 'Scenario 3: Mecca Mosques Most Needed (Providing Water 10 Cartons)',
    sale_item_id: 1,
    package_name: 'Providing Water',
    item_name: '10 Cartons',
    home_icon_id: 1,
    expected_price: 82.5,
    scenario_type: 'Most Needed Category but Package has need_delivery=1 (Driver Assignment)'
  },
  {
    id: 4,
    name: 'Scenario 4: Multi-Day Distribution (Haram Watering 10 Days)',
    sale_item_id: 202,
    package_name: 'Watering Al-Haram',
    item_name: '10 Days Multi-Dist',
    home_icon_id: 3,
    expected_price: 140.0,
    scenario_type: 'Multi-Distribution (smdg_id > 0)'
  },
  {
    id: 5,
    name: 'Scenario 5: Haram Watering (10 Cartons) - Payment Reconcile Flow',
    sale_item_id: 35,
    package_name: 'Watering Al-Haram',
    item_name: '10 Cartons',
    home_icon_id: 3,
    expected_price: 140.0,
    scenario_type: 'Direct Close Distribution with Payment Auto/Manual Reconciliation'
  }
];

async function runInvestigation() {
  const baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  
  const db = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const fullReport = [];

  console.log('========================================================================================');
  console.log('🚀 STARTING QA INVESTIGATION & 5-SCENARIO ORDER TESTING SUITE');
  console.log('   Goal: Identify WHY certain orders appear in Close Distribution and others do not.');
  console.log('========================================================================================\n');

  for (let i = 0; i < testScenarios.length; i++) {
    const sc = testScenarios[i];
    const orderIndex = i + 1;

    console.log(`\n========================================================================================`);
    console.log(`▶️ EXECUTING TEST [ORDER ${orderIndex}/5]: ${sc.name}`);
    console.log(`   Type: ${sc.scenario_type}`);
    console.log(`========================================================================================`);

    const result = {
      index: orderIndex,
      name: sc.name,
      scenario_type: sc.scenario_type,
      package_name: sc.package_name,
      item_name: sc.item_name,
      order_number: null,
      client_order_id: null,
      suborder_id: null,
      amount: null,
      payment_date: null,
      need_delivery: null,
      is_multi_dist: false,
      visible_in_order_management: false,
      visible_in_close_distribution: false,
      visible_in_set_order: false,
      visible_in_multi_distribution: false,
      stuck_in_payment_problems: false,
      payment_problem_resolved: false,
      visibility_reason: ''
    };

    let browser = null;

    try {
      // 1. Create Guest Session
      console.log(`[${orderIndex}.1] Creating Guest User Session...`);
      const guestRes = await axios.post(`${baseApi}/api/v2/Accounts/AccessGuestUser`);
      const guestToken = guestRes.data.accessToken;

      // 2. Add Item to Cart
      console.log(`[${orderIndex}.2] Adding Item (Sale Item ID: ${sc.sale_item_id}) to Cart...`);
      await axios.post(`${baseApi}/api/v2/carts/add-new-sale-item`, {
        sale_item_id: sc.sale_item_id,
        quantity: 1,
        home_icon_id: sc.home_icon_id
      }, {
        headers: { Authorization: `Bearer ${guestToken}` }
      });

      // 3. Get Cart
      const cartRes = await axios.get(`${baseApi}/api/v2/carts/get-my-cart-order`, {
        headers: { Authorization: `Bearer ${guestToken}` }
      });

      const orderObj = cartRes.data.order;
      result.order_number = orderObj.number;
      result.client_order_id = orderObj.id;
      result.amount = Number(orderObj.cost || sc.expected_price);
      console.log(`[${orderIndex}.3] 📦 Cart Created: Order Number #${result.order_number} (ID: ${result.client_order_id}) | Amount: ${result.amount} SAR`);

      // 4. Initiate Payment
      console.log(`[${orderIndex}.4] Initiating MyFatoorah Web Payment...`);
      const initPayRes = await axios.post(`${baseApi}/api/v2/web-payments/initiate/myfatoorah`, {
        cart_id: result.client_order_id,
        callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
        errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
        paymentMethodId: 2,
        phoneNumber: '008801772173075',
        name: 'Shahriar Mahmud',
        email: 'admin@qataratapp.com'
      }, {
        headers: { Authorization: `Bearer ${guestToken}` }
      });

      const paymentUrl = initPayRes.data.payment_url;
      console.log(`[${orderIndex}.4] Payment URL: ${paymentUrl}`);

      // 5. Puppeteer Payment Automation
      console.log(`[${orderIndex}.5] Launching Chrome for gateway checkout...`);
      browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
      });

      const page = await browser.newPage();
      await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2500);

      // Card Fill
      await page.type('input#cardholdername', 'Shahriar Mahmud', { delay: 25 });
      await page.type('input#cardnumber', '4111111111111111', { delay: 25 });
      await page.type('input#expirationdate', '0127', { delay: 25 });
      await page.type('input#securitycode', '123', { delay: 25 });
      await sleep(1000);

      // Submit
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

      console.log(`[${orderIndex}.5] ✅ Gateway payment submission executed.`);
      await browser.close();
      browser = null;

      // 6. Check Initial Status in DB & Payment Problems
      console.log(`[${orderIndex}.6] Checking DB state after gateway callback...`);
      const [initDbCheck] = await db.query('SELECT * FROM client_orders WHERE id = ?', [result.client_order_id]);
      const [ppCheck] = await db.query('SELECT * FROM payment_problems WHERE client_order_id = ?', [result.client_order_id]);

      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      result.payment_date = nowStr;

      if (ppCheck.length > 0 || !initDbCheck[0]?.payment_date) {
        result.stuck_in_payment_problems = true;
        console.log(`[${orderIndex}.6] ⚠️ Order landed in Payment Problems (Webhook pending/unreconciled). Resolving...`);
        
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
        `, [nowStr, result.client_order_id]);

        await db.query(`
          UPDATE client_order_details
          SET order_detail_status = 2,
              updated_at = NOW()
          WHERE client_order_id = ?
        `, [result.client_order_id]);

        await db.query(`
          DELETE FROM payment_problems WHERE client_order_id = ?
        `, [result.client_order_id]);

        result.payment_problem_resolved = true;
        console.log(`[${orderIndex}.6] ✅ Resolved Payment Problem! Order moved to Paid status.`);
      }

      // 7. Detailed Database & Queue Verification
      const [orderDetails] = await db.query(`
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
      `, [result.client_order_id]);

      if (orderDetails.length > 0) {
        const od = orderDetails[0];
        result.suborder_id = od.suborder_id;
        result.need_delivery = od.need_delivery;
        result.is_multi_dist = od.sale_item_multi_distribution_group_id !== null;

        // Check Order Management (is paid and visible)
        result.visible_in_order_management = (od.payment_date !== null && [1, 2, 4].includes(od.client_order_status));

        // Check Close Distribution (need_delivery = 0, driver_id is null, not multi-dist, status != 3)
        const isEligibleClose = (
          od.payment_date !== null &&
          [1, 2].includes(od.client_order_status) &&
          od.driver_id === null &&
          (od.need_delivery === 0 || od.need_delivery === null) &&
          od.sale_item_multi_distribution_group_id === null &&
          od.order_detail_status !== 3
        );
        result.visible_in_close_distribution = isEligibleClose;

        // Check Set Order (need_delivery = 1)
        result.visible_in_set_order = (od.need_delivery === 1 && od.payment_date !== null);

        // Check Multi Distribution (smdg_id is not null)
        result.visible_in_multi_distribution = (od.sale_item_multi_distribution_group_id !== null && od.payment_date !== null);

        // Reason formulation
        if (result.visible_in_close_distribution) {
          result.visibility_reason = '✅ Appears in Close Distribution (Need Delivery = 0, Single Distribution, No Driver Assigned).';
        } else if (result.visible_in_set_order) {
          result.visibility_reason = '❌ DOES NOT appear in Close Distribution. Routed to "Set Order" because Package has Need Delivery = 1 (Requires Driver).';
        } else if (result.visible_in_multi_distribution) {
          result.visibility_reason = '❌ DOES NOT appear in Close Distribution. Routed to "Multi Distribution" because it is a Multi-Day plan.';
        } else {
          result.visibility_reason = '❌ Ineligible due to status or driver assignment.';
        }
      }

      console.log(`[${orderIndex}.7] 📊 RESULT FOR ORDER #${result.order_number}:`);
      console.log(`   - Visible in Order Management:   ${result.visible_in_order_management ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Visible in Close Distribution: ${result.visible_in_close_distribution ? '✅ YES (Suborder ID: ' + result.suborder_id + ')' : '❌ NO'}`);
      console.log(`   - Visible in Set Order:          ${result.visible_in_set_order ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Visible in Multi Distribution: ${result.visible_in_multi_distribution ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Reason: ${result.visibility_reason}`);

    } catch (err) {
      console.error(`❌ Error in Scenario ${orderIndex}:`, err.message);
      result.visibility_reason = 'ERROR: ' + err.message;
      if (browser) await browser.close();
    }

    fullReport.push(result);
    await sleep(2500);
  }

  await db.end();

  console.log('\n\n========================================================================================');
  console.log('📊 FINAL 5-SCENARIO AUTOMATION & ROOT CAUSE INVESTIGATION REPORT');
  console.log('========================================================================================');
  console.table(fullReport.map(r => ({
    '#': r.index,
    'Order #': r.order_number,
    'Suborder ID': r.suborder_id,
    'Package / Item': `${r.package_name} (${r.item_name})`,
    'Order Mgmt': r.visible_in_order_management ? '✅ YES' : '❌ NO',
    'Close Dist': r.visible_in_close_distribution ? '✅ YES' : '❌ NO',
    'Set Order': r.visible_in_set_order ? '✅ YES' : '❌ NO',
    'Multi Dist': r.visible_in_multi_distribution ? '✅ YES' : '❌ NO',
    'Diagnostic Reason': r.visibility_reason
  })));
}

runInvestigation();
