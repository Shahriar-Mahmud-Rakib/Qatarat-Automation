const axios = require('axios');
const puppeteer = require('puppeteer-core');
const pool = require('../config/db');
const VerifierService = require('./verifierService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const CLOSE_DISTRIBUTION_ITEMS = [
  { name: 'Watering Al-Haram (5 Cartons)', package_name: 'Watering Al-Haram', item_name: '5 Cartons', sale_item_id: 95, home_icon_id: 3, expected_price: 82.5 },
  { name: 'Haram Meal (5 Meals)', package_name: 'Haram Meal', item_name: '5 Meals', sale_item_id: 107, home_icon_id: 3, expected_price: 75.0 },
  { name: 'Watering Al-Haram (10 Cartons)', package_name: 'Watering Al-Haram', item_name: '10 Cartons', sale_item_id: 35, home_icon_id: 3, expected_price: 140.0 },
  { name: 'Haram Meal (10 Meals)', package_name: 'Haram Meal', item_name: '10 Meals', sale_item_id: 47, home_icon_id: 3, expected_price: 150.0 },
  { name: 'Watering Al-Haram (20 Cartons)', package_name: 'Watering Al-Haram', item_name: '20 Cartons', sale_item_id: 36, home_icon_id: 3, expected_price: 255.0 },
  { name: 'Haram Meal (20 Meals)', package_name: 'Haram Meal', item_name: '20 Meals', sale_item_id: 48, home_icon_id: 3, expected_price: 300.0 },
  { name: 'Watering Al-Haram (50 Cartons)', package_name: 'Watering Al-Haram', item_name: '50 Cartons', sale_item_id: 38, home_icon_id: 3, expected_price: 625.0 },
  { name: 'Haram Meal (30 Meals)', package_name: 'Haram Meal', item_name: '30 Meals', sale_item_id: 49, home_icon_id: 3, expected_price: 450.0 },
  { name: 'Watering Al-Haram (30 Cartons)', package_name: 'Watering Al-Haram', item_name: '30 Cartons', sale_item_id: 37, home_icon_id: 3, expected_price: 370.0 },
  { name: 'Haram Meal (50 Meals)', package_name: 'Haram Meal', item_name: '50 Meals', sale_item_id: 50, home_icon_id: 3, expected_price: 750.0 }
];

const SET_ORDER_ITEMS = [
  { name: 'Providing Water (10 Cartons - Driver Delivery)', package_name: 'Providing Water', item_name: '10 Cartons', sale_item_id: 1, home_icon_id: 1, expected_price: 82.5 },
  { name: 'Providing Water (20 Cartons - Driver Delivery)', package_name: 'Providing Water', item_name: '20 Cartons', sale_item_id: 2, home_icon_id: 1, expected_price: 165.0 }
];

const MIXED_ITEMS = [
  ...CLOSE_DISTRIBUTION_ITEMS.slice(0, 3),
  SET_ORDER_ITEMS[0],
  ...CLOSE_DISTRIBUTION_ITEMS.slice(3, 7),
  SET_ORDER_ITEMS[1],
  ...CLOSE_DISTRIBUTION_ITEMS.slice(7)
];

const SINGLE_USER_PROFILE = {
  id: 1593074,
  name: 'Shahriar Mahmud (Single User)',
  country_code: '880',
  mobile_number: '1772173075',
  phone: '8801772173075',
  email: 'shahriar@qataratapp.com'
};

class OrderService {
  constructor() {
    this.baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  }

  /**
   * Generates a fresh guest session token and user ID
   */
  async createGuestSession() {
    const res = await axios.post(`${this.baseApi}/api/v2/Accounts/AccessGuestUser`);
    return {
      token: res.data.accessToken,
      userId: res.data.id
    };
  }

  /**
   * Generates randomized customer profile for multi-user tests
   */
  generateCustomerProfile(index = 1) {
    const uniqueMobile = String(171000000 + (index % 800000));
    return {
      id: null,
      name: `User ${index} (Multi-QA)`,
      country_code: '880',
      mobile_number: uniqueMobile,
      phone: `880${uniqueMobile}`,
      email: `user${index}_${Date.now()}@qataratapp.com`
    };
  }

  /**
   * Adds an item to the cart and returns the created client_order
   */
  async createOrderCart(token, saleItemId, homeIconId, quantity = 1) {
    await axios.post(`${this.baseApi}/api/v2/carts/add-new-sale-item`, {
      sale_item_id: saleItemId,
      quantity,
      home_icon_id: homeIconId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const res = await axios.get(`${this.baseApi}/api/v2/carts/get-my-cart-order`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return res.data.order;
  }

  /**
   * Initiates payment with the gateway API
   */
  async initiatePayment(token, cartId, cardType = 'myfatoorah', customer = null) {
    const cust = customer || SINGLE_USER_PROFILE;

    const res = await axios.post(`${this.baseApi}/api/v2/web-payments/initiate/myfatoorah`, {
      cart_id: cartId,
      callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
      errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
      paymentMethodId: 2,
      phoneNumber: cust.phone,
      name: cust.name,
      email: cust.email
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return res.data.payment_url;
  }

  /**
   * Automates payment on real payment gateway using Puppeteer (Headless Chrome)
   */
  async automatePaymentGateway(paymentUrl, cardType = 'myfatoorah') {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
    });

    try {
      const page = await browser.newPage();
      await page.goto(paymentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2500);

      const cardNumber = cardType === 'paytabs' ? '4000000000000002' : '4111111111111111';

      await page.type('input#cardholdername', 'Test Customer', { delay: 20 });
      await page.type('input#cardnumber', cardNumber, { delay: 20 });
      await page.type('input#expirationdate', '0127', { delay: 20 });
      await page.type('input#securitycode', '123', { delay: 20 });
      await sleep(1000);

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('pay now'));
        if (btn) btn.click();
      });

      await sleep(7000);

      const submit3ds = await page.$('button[type="submit"], input[type="submit"], #btnSubmit');
      if (submit3ds) {
        await submit3ds.click();
        await sleep(5000);
      }
    } finally {
      await browser.close();
    }
  }

  /**
   * Marks an order as Paid and reconciles in database
   */
  async ensurePaymentReconciled(orderNumberOrId, customer = null, userId = null) {
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Lookup real DB order
    const [orders] = await pool.query(
      'SELECT id, client_id, number FROM client_orders WHERE number = ? OR id = ? ORDER BY id DESC LIMIT 1',
      [orderNumberOrId, orderNumberOrId]
    );

    if (orders.length === 0) {
      throw new Error(`Order #${orderNumberOrId} not found in client_orders database`);
    }

    const realOrderId = orders[0].id;
    const finalClientId = userId || (customer && customer.id) || orders[0].client_id || 1593074;

    await pool.query(`
      UPDATE client_orders 
      SET client_order_status = 2,
          payment_date = ?,
          client_id = ?,
          payment_gateway = ?,
          auto_reconcile_attempted = 1,
          updated_at = NOW()
      WHERE id = ?
    `, [nowStr, finalClientId, orders[0].payment_gateway || 'myfatoorah', realOrderId]);

    await pool.query(`
      UPDATE client_order_details
      SET order_detail_status = 2,
          updated_at = NOW()
      WHERE client_order_id = ?
    `, [realOrderId]);

    // Insert outbox entry for new asynchronous payment architecture
    const outboxPayload = JSON.stringify({
      Event: { Code: 1, Name: 'PAYMENT_STATUS_CHANGED' },
      Data: {
        Invoice: { Id: String(realOrderId), Status: 'PAID', Reference: orders[0].number },
        Transaction: { Status: 'SUCCESS', PaymentMethod: 'VISA/MASTER' }
      }
    });
    await pool.query(`
      INSERT INTO payment_job_outbox (client_order_id, transaction_reference, payment_gateway, payload, dispatched_at, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `, [realOrderId, `TX-${realOrderId}`, orders[0].payment_gateway || 'myfatoorah', outboxPayload]);

    await pool.query('DELETE FROM payment_problems WHERE client_order_id = ?', [realOrderId]);

    return realOrderId;
  }

  /**
   * Executes a single order scenario
   */
  async executeSingleOrder({ scenario, cardType = 'myfatoorah', customer = null, executionMode = 'fast' }) {
    // 1. Create fresh session token & unique guest user ID
    const guestSession = await this.createGuestSession();
    const token = guestSession.token;
    const userId = guestSession.userId;

    // 2. Set distinct customer details in DB for this guest user (with unique phone split fields)
    if (customer) {
      await pool.query(
        'UPDATE users SET name = ?, phone_number = ?, country_code = ?, mobile_number = ?, email = ?, updated_at = NOW() WHERE id = ?',
        [
          customer.name,
          customer.phone,
          customer.country_code || '880',
          customer.mobile_number || customer.phone.slice(-10),
          customer.email,
          userId
        ]
      );
    }

    // 3. Add item to cart and get cart order
    const orderObj = await this.createOrderCart(token, scenario.sale_item_id, scenario.home_icon_id);
    
    // 4. Initiate payment URL (cart_id = orderObj.id)
    const paymentUrl = await this.initiatePayment(token, orderObj.id, cardType, customer);

    // 5. Complete payment (Browser 3DS flow OR Fast API Direct flow)
    if (executionMode === 'browser') {
      await this.automatePaymentGateway(paymentUrl, cardType);
    }

    // 6. Ensure DB consistency & payment marked on the REAL client_order in MySQL
    const realDbOrderId = await this.ensurePaymentReconciled(orderObj.number, customer, userId);

    // 7. Verify 5 Close Distribution rules
    const visibility = await VerifierService.getOrderVisibility(realDbOrderId);

    return {
      orderNumber: visibility.orderNumber,
      clientOrderId: visibility.clientOrderId,
      suborderId: visibility.suborderId,
      userId: visibility.userId,
      customerName: visibility.customerName || (customer ? customer.name : 'Single User'),
      customerPhone: visibility.customerPhone || (customer ? customer.phone : 'N/A'),
      package_name: visibility.package_name,
      item_name: visibility.item_name,
      cost: visibility.cost,
      payment_date: visibility.payment_date,
      inOrderManagement: visibility.inOrderManagement,
      inCloseDistribution: visibility.inCloseDistribution,
      inSetOrder: visibility.inSetOrder,
      diagnostic: visibility.diagnostic
    };
  }

  /**
   * Flexible Order Batch Runner: Supports any number of orders (1 to 500+),
   * Single-User vs Multi-User modes, and Close-Distribution vs Mixed categories.
   */
  async runFlexibleOrders({
    count = 50,
    userMode = 'single',         // 'single' (same user) OR 'multi' (N distinct users)
    category = 'close-dist',     // 'close-dist', 'mixed', 'set-order'
    executionMode = 'fast',      // 'fast' (API+Reconcile) OR 'browser' (Puppeteer Headless)
    cardType = 'myfatoorah',
    concurrency = 5
  } = {}) {
    console.log(`\n================================================================================`);
    console.log(`🚀 STARTING FLEXIBLE ORDER AUTOMATION ENGINE`);
    console.log(`📊 Total Orders Requested: ${count}`);
    console.log(`👤 User Mode:            ${userMode.toUpperCase()} (${userMode === 'single' ? 'Same User placed all orders' : `${count} Distinct Unique Users`})`);
    console.log(`📦 Order Category:        ${category.toUpperCase()}`);
    console.log(`⚡ Execution Speed:       ${executionMode.toUpperCase()} MODE (Concurrency: ${executionMode === 'browser' ? 1 : concurrency})`);
    console.log(`💳 Payment Gateway:       ${cardType.toUpperCase()}`);
    console.log(`================================================================================\n`);

    // Pick item catalog based on category
    let catalog = CLOSE_DISTRIBUTION_ITEMS;
    if (category === 'set-order') catalog = SET_ORDER_ITEMS;
    if (category === 'mixed') catalog = MIXED_ITEMS;

    const singleCustomer = { ...SINGLE_USER_PROFILE };
    const results = new Array(count);
    const startTime = Date.now();

    // Work queue for concurrent execution
    const actualConcurrency = executionMode === 'browser' ? 1 : Math.min(concurrency, 10);
    let currentIndex = 0;

    const worker = async (workerId) => {
      while (currentIndex < count) {
        const i = currentIndex++;
        const scenario = catalog[i % catalog.length];
        const orderNumLabel = `[${i + 1}/${count}]`;

        const customer = userMode === 'single'
          ? singleCustomer
          : this.generateCustomerProfile(i + 1);

        try {
          const res = await this.executeSingleOrder({
            scenario,
            cardType,
            customer,
            executionMode
          });

          results[i] = res;
          console.log(`▶️ ${orderNumLabel} User: ${res.customerName} (${res.customerPhone}) | Item: ${res.package_name} -> Order #${res.orderNumber} (Suborder: ${res.suborderId}) | Close Dist: ${res.inCloseDistribution ? '✅ YES' : '❌ NO'}`);
        } catch (err) {
          console.log(`❌ ${orderNumLabel} User: ${customer.name} | FAILED: ${err.message}`);
          results[i] = {
            orderNumber: 'FAILED',
            clientOrderId: null,
            suborderId: null,
            userId: null,
            customerName: customer.name,
            customerPhone: customer.phone,
            package_name: scenario.package_name,
            item_name: scenario.item_name,
            cost: scenario.expected_price,
            payment_date: null,
            inOrderManagement: false,
            inCloseDistribution: false,
            inSetOrder: false,
            diagnostic: 'ERROR: ' + err.message
          };
        }

        if (executionMode === 'fast') {
          await sleep(100);
        } else {
          await sleep(1500);
        }
      }
    };

    // Run workers
    const workers = [];
    for (let w = 0; w < actualConcurrency; w++) {
      workers.push(worker(w + 1));
    }
    await Promise.all(workers);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Batch of ${count} Orders Completed in ${durationSec}s!`);

    return results;
  }

  /**
   * Backwards compatible legacy runBatch
   */
  async runBatch(count = 5, cardType = 'myfatoorah') {
    return await this.runFlexibleOrders({
      count,
      userMode: 'single',
      category: 'mixed',
      executionMode: count <= 5 ? 'browser' : 'fast',
      cardType
    });
  }
}

module.exports = new OrderService();
