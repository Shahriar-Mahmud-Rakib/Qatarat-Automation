const axios = require('axios');
const pool = require('../config/db');
const VerifierService = require('./verifierService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

class SubscriptionService {
  constructor() {
    this.baseApi = 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
    this.apiKey = 'qatarat-subscription-generate-api-key-dev';
  }

  /**
   * Updates a single subscription next_generate_date to target date (unique_active_client_flag is auto-computed)
   */
  async setSubscriptionDate(subscriptionId, targetDateStr = '2026-11-01 00:00:00') {
    await pool.query(`
      UPDATE subscriptions 
      SET next_generate_date = ?,
          active = 1,
          canceled_date = NULL,
          updated_at = NOW()
      WHERE id = ?
    `, [targetDateStr, subscriptionId]);
  }

  /**
   * Batch updates multiple subscriptions to target date (unique_active_client_flag is auto-computed)
   */
  async setBatchSubscriptionDates(subscriptionIds, targetDateStr = '2026-11-01 00:00:00') {
    if (!subscriptionIds || subscriptionIds.length === 0) return;
    const placeholders = subscriptionIds.map(() => '?').join(',');
    await pool.query(`
      UPDATE subscriptions 
      SET next_generate_date = ?,
          active = 1,
          canceled_date = NULL,
          updated_at = NOW()
      WHERE id IN (${placeholders})
    `, [targetDateStr, ...subscriptionIds]);
  }

  /**
   * Calls the subscription generate-orders worker API
   */
  async triggerGenerateOrders(date = '2026-11-01') {
    const res = await axios.get(`${this.baseApi}/api/v2/subscriptions/generate-orders?date=${date}`, {
      headers: {
        'subscription-api-key': this.apiKey
      }
    });
    return res.data;
  }

  /**
   * Retrieves N active distinct subscriptions from DB (filtered by Close Distribution if requested)
   */
  async fetchActiveSubscriptions(count = 50, filterCloseDistribution = true) {
    const deliveryCondition = filterCloseDistribution ? 'AND p.need_delivery = 0' : '';
    const [rows] = await pool.query(`
      SELECT 
        s.id AS subscription_id,
        s.client_id,
        s.unique_active_client_flag,
        COALESCE(u.phone_number, CONCAT('880', s.client_id)) AS phone_number,
        u.country_code,
        u.mobile_number,
        COALESCE(u.name, CONCAT('Subscriber #', s.client_id)) AS user_name,
        p.name AS package_name,
        p.need_delivery,
        si.name AS item_name,
        s.subscription_type
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.client_id
      JOIN client_orders co ON co.id = s.client_order_id
      JOIN client_order_details cod ON cod.client_order_id = co.id
      JOIN sale_items si ON si.id = cod.sale_item_id
      JOIN packages p ON p.id = si.package_id
      WHERE s.active = 1
        AND s.deleted_at IS NULL
        ${deliveryCondition}
      GROUP BY s.id, s.client_id, s.unique_active_client_flag, u.phone_number, u.country_code, u.mobile_number, u.name, p.name, p.need_delivery, si.name, s.subscription_type
      ORDER BY s.id DESC
      LIMIT ?
    `, [count]);

    return rows;
  }

  /**
   * Retrieves latest generated order for a subscription
   */
  async getLatestGeneratedOrder(subscriptionId) {
    const [rows] = await pool.query(`
      SELECT 
        so.id AS sub_order_link_id,
        so.subscription_id,
        so.client_order_id,
        so.client_order_number,
        co.client_order_status,
        co.payment_date,
        co.cost,
        co.due_date,
        co.created_at,
        p.id AS package_id,
        p.name AS package_name,
        p.need_delivery,
        cod.id AS suborder_id,
        cod.order_detail_status
      FROM subscription_orders so
      JOIN client_orders co ON co.id = so.client_order_id
      JOIN client_order_details cod ON cod.client_order_id = co.id
      JOIN sale_items si ON si.id = cod.sale_item_id
      JOIN packages p ON p.id = si.package_id
      WHERE so.subscription_id = ?
      ORDER BY so.id DESC
      LIMIT 1
    `, [subscriptionId]);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Simulates payment confirmation for a generated subscription order and writes to outbox
   */
  async confirmPayment(clientOrderId) {
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    await pool.query(`
      UPDATE client_orders 
      SET client_order_status = 2,
          payment_date = ?,
          payment_gateway = 'subscription_auto_debit',
          auto_reconcile_attempted = 1,
          updated_at = NOW()
      WHERE id = ?
    `, [nowStr, clientOrderId]);

    await pool.query(`
      UPDATE client_order_details 
      SET order_detail_status = 2,
          updated_at = NOW()
      WHERE client_order_id = ?
    `, [clientOrderId]);

    // Insert outbox entry for asynchronous payment processing
    const outboxPayload = JSON.stringify({
      Event: { Code: 1, Name: 'PAYMENT_STATUS_CHANGED' },
      Data: {
        Invoice: { Id: String(clientOrderId), Status: 'PAID' },
        Transaction: { Status: 'SUCCESS', PaymentMethod: 'SUBSCRIPTION_RECURRING' }
      }
    });
    await pool.query(`
      INSERT INTO payment_job_outbox (client_order_id, transaction_reference, payment_gateway, payload, dispatched_at, attempts, created_at, updated_at)
      VALUES (?, ?, 'subscription_auto_debit', ?, NOW(), 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `, [clientOrderId, `SUB-TX-${clientOrderId}`, outboxPayload]);

    await pool.query('DELETE FROM payment_problems WHERE client_order_id = ?', [clientOrderId]);
  }

  /**
   * Runs flexible subscription test across N distinct users/subscriptions
   */
  async runFlexibleSubscriptionTest({
    count = 50,
    targetDate = '2026-09-28',
    filterCloseDistribution = true
  } = {}) {
    console.log(`\n================================================================================`);
    console.log(`🚀 STARTING DYNAMIC MULTI-USER SUBSCRIPTION WORKER TEST`);
    console.log(`👥 Target User / Subscription Count: ${count}`);
    console.log(`📅 Execution Date:                   ${targetDate}`);
    console.log(`📦 Filter Close Distribution Only:   ${filterCloseDistribution ? 'YES (need_delivery = 0)' : 'NO (all)'}`);
    console.log(`================================================================================\n`);

    // 1. Discover subscriptions from DB
    console.log(`1. Querying ${count} active subscriptions from database...`);
    const subscriptions = await this.fetchActiveSubscriptions(count, filterCloseDistribution);
    
    if (subscriptions.length === 0) {
      throw new Error(`No active subscriptions found matching criteria.`);
    }

    console.log(`   Found ${subscriptions.length} active subscriptions across distinct users.\n`);

    // 2. Set dates in batch
    console.log(`2. Setting next_generate_date = '${targetDate} 00:00:00' for all ${subscriptions.length} subscriptions...`);
    const subIds = subscriptions.map(s => s.subscription_id);
    await this.setBatchSubscriptionDates(subIds, `${targetDate} 00:00:00`);
    console.log(`   ✅ Subscriptions updated and armed for worker.\n`);

    // 3. Trigger worker API
    console.log(`3. Triggering Worker API: GET /api/v2/subscriptions/generate-orders?date=${targetDate} ...`);
    const startTime = Date.now();
    try {
      const workerRes = await this.triggerGenerateOrders(targetDate);
      console.log(`   📡 Worker API completed successfully. Response:`, JSON.stringify(workerRes).slice(0, 150) + '...\n');
    } catch (err) {
      console.error(`   ⚠️ Worker API Error:`, err.response ? err.response.data : err.message);
    }

    await sleep(2500);

    // 4. Verify orders, confirm payments, and validate Close Distribution
    console.log(`4. Reconciling generated orders & evaluating Close Distribution rules for all ${subscriptions.length} users:\n`);

    const results = [];

    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      const label = `[${i + 1}/${subscriptions.length}]`;
      process.stdout.write(`▶️ ${label} User #${sub.client_id} (Sub #${sub.subscription_id} - ${sub.package_name})... `);

      try {
        const generated = await this.getLatestGeneratedOrder(sub.subscription_id);

        if (!generated) {
          console.log(`❌ No order generated`);
          results.push({
            index: i + 1,
            subscriptionId: sub.subscription_id,
            clientId: sub.client_id,
            userPhone: sub.phone_number,
            packageName: sub.package_name,
            orderNumber: 'NONE',
            clientOrderId: null,
            suborderId: null,
            cost: 0,
            inOrderManagement: false,
            inCloseDistribution: false,
            inSetOrder: false,
            nextGenerateDate: 'N/A',
            diagnostic: 'Worker did not generate order'
          });
          continue;
        }

        // Auto confirm payment
        await this.confirmPayment(generated.client_order_id);

        // Check visibility
        const visibility = await VerifierService.getOrderVisibility(generated.client_order_id);

        // Check next_generate_date
        const [subRows] = await pool.query('SELECT next_generate_date FROM subscriptions WHERE id = ?', [sub.subscription_id]);
        const nextDate = subRows[0]?.next_generate_date;

        const isSuccess = visibility.inCloseDistribution;
        console.log(`✅ Order #${generated.client_order_number} | Close Dist: ${isSuccess ? '✅ YES' : '❌ NO'} | Next Date: ${nextDate ? new Date(nextDate).toISOString().split('T')[0] : 'N/A'}`);

        results.push({
          index: i + 1,
          subscriptionId: sub.subscription_id,
          clientId: sub.client_id,
          userPhone: sub.phone_number,
          packageName: generated.package_name,
          orderNumber: generated.client_order_number,
          clientOrderId: generated.client_order_id,
          suborderId: generated.suborder_id,
          cost: generated.cost,
          inOrderManagement: visibility.inOrderManagement,
          inCloseDistribution: visibility.inCloseDistribution,
          inSetOrder: visibility.inSetOrder,
          nextGenerateDate: nextDate,
          diagnostic: visibility.diagnostic
        });

      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
        results.push({
          index: i + 1,
          subscriptionId: sub.subscription_id,
          clientId: sub.client_id,
          userPhone: sub.phone_number,
          packageName: sub.package_name,
          orderNumber: 'ERROR',
          clientOrderId: null,
          suborderId: null,
          cost: 0,
          inOrderManagement: false,
          inCloseDistribution: false,
          inSetOrder: false,
          nextGenerateDate: 'ERROR',
          diagnostic: err.message
        });
      }

      await sleep(150);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Multi-User Subscription Flow Completed in ${durationSec}s!`);

    return results;
  }

  /**
   * Single subscription test runner
   */
  async runSingleSubscriptionTest(subscriptionId = 9216, targetDate = '2026-09-28') {
    await this.setSubscriptionDate(subscriptionId, `${targetDate} 00:00:00`);
    await this.triggerGenerateOrders(targetDate);
    await sleep(2000);

    const generated = await this.getLatestGeneratedOrder(subscriptionId);
    if (!generated) {
      throw new Error(`No order generated for subscription #${subscriptionId}`);
    }

    await this.confirmPayment(generated.client_order_id);
    const visibility = await VerifierService.getOrderVisibility(generated.client_order_id);
    const [subRows] = await pool.query('SELECT previous_generated_date, next_generate_date FROM subscriptions WHERE id = ?', [subscriptionId]);

    return {
      subscriptionId,
      orderNumber: generated.client_order_number,
      clientOrderId: generated.client_order_id,
      suborderId: generated.suborder_id,
      packageName: generated.package_name,
      needDelivery: generated.need_delivery,
      inOrderManagement: visibility.inOrderManagement,
      inCloseDistribution: visibility.inCloseDistribution,
      inSetOrder: visibility.inSetOrder,
      previousGeneratedDate: subRows[0]?.previous_generated_date,
      nextGenerateDate: subRows[0]?.next_generate_date,
      diagnostic: visibility.diagnostic
    };
  }

  /**
   * Backwards compatible runSubscriptionTest
   */
  async runSubscriptionTest(subscriptionId = 9216, targetDate = '2026-09-28') {
    return await this.runSingleSubscriptionTest(subscriptionId, targetDate);
  }
}

module.exports = new SubscriptionService();
