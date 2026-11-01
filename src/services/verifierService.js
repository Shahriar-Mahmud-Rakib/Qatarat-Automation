const pool = require('../config/db');

class VerifierService {
  /**
   * Evaluates an order or sub-order against the 5 strict Close Distribution rules
   */
  static evaluateCloseDistribution(order) {
    const isPaymentReceived = [1, 2, 6].includes(order.client_order_status);
    const hasPaymentDate = order.payment_date !== null;
    const noDriver = order.driver_id === null;
    const needDeliveryOff = order.need_delivery === 0 || order.need_delivery === null;
    const isOneTime = order.sale_item_multi_distribution_group_id === null;
    const isPending = [1, 2, 6].includes(order.order_detail_status);

    const isEligible = isPaymentReceived && hasPaymentDate && noDriver && needDeliveryOff && isOneTime && isPending;

    const reasons = [];
    if (!isPaymentReceived || !hasPaymentDate) reasons.push('Payment not completed or payment_date is NULL');
    if (!noDriver) reasons.push(`Driver allocated (driver_id: ${order.driver_id})`);
    if (!needDeliveryOff) reasons.push('Package has need_delivery = 1 (Routed to Set Order for driver delivery)');
    if (!isOneTime) reasons.push('Item has multi_distribution_group_id (Routed to Multi Distribution)');
    if (!isPending) reasons.push(`Detail status is ${order.order_detail_status} (Already completed/delivered or invalid)`);

    return {
      isEligible,
      rules: {
        paymentStatus: isPaymentReceived && hasPaymentDate,
        noDriver,
        needDeliveryOff,
        isOneTime,
        isPending
      },
      reasons: reasons.length > 0 ? reasons.join('; ') : 'All 5 Close Distribution criteria satisfied'
    };
  }

  /**
   * Retrieves comprehensive visibility state across all Admin modules for a given client order ID
   */
  static async getOrderVisibility(orderIdOrNumber) {
    const [rows] = await pool.query(`
      SELECT 
        cod.id AS suborder_id,
        co.id AS client_order_id,
        co.number AS main_order_number,
        co.client_order_status,
        co.payment_date,
        co.driver_id,
        co.cost,
        co.payment_gateway,
        u.id AS user_id,
        u.name AS customer_name,
        u.phone_number AS customer_phone,
        p.id AS package_id,
        p.name AS package_name,
        p.need_delivery,
        si.id AS sale_item_id,
        si.name AS item_name,
        cod.order_detail_status,
        cod.sale_item_multi_distribution_group_id
      FROM client_orders co
      LEFT JOIN client_order_details cod ON cod.client_order_id = co.id
      LEFT JOIN sale_items si ON si.id = cod.sale_item_id
      LEFT JOIN packages p ON p.id = si.package_id
      LEFT JOIN users u ON u.id = co.client_id
      WHERE co.id = ? OR co.number = ?
      LIMIT 1
    `, [orderIdOrNumber, String(orderIdOrNumber)]);

    if (rows.length === 0) {
      return null;
    }

    const first = rows[0];
    const [ppRows] = await pool.query('SELECT * FROM payment_problems WHERE client_order_id = ?', [first.client_order_id]);

    const evalResult = this.evaluateCloseDistribution(first);

    return {
      clientOrderId: first.client_order_id,
      orderNumber: first.main_order_number,
      suborderId: first.suborder_id,
      userId: first.user_id,
      customerName: first.customer_name,
      customerPhone: first.customer_phone,
      package_name: first.package_name,
      item_name: first.item_name,
      cost: first.cost,
      payment_date: first.payment_date,
      client_order_status: first.client_order_status,
      need_delivery: first.need_delivery,
      inOrderManagement: first.payment_date !== null && [1, 2, 4, 6].includes(first.client_order_status),
      inCloseDistribution: evalResult.isEligible,
      inSetOrder: first.need_delivery === 1 && first.payment_date !== null,
      inMultiDistribution: first.sale_item_multi_distribution_group_id !== null && first.payment_date !== null,
      inPaymentProblems: ppRows.length > 0,
      diagnostic: evalResult.reasons
    };
  }

  /**
   * Retrieves active Close Distribution orders from the database
   */
  static async getActiveCloseDistributionOrders(limit = 10) {
    const [orders] = await pool.query(`
      SELECT 
        cod.id AS suborder_id,
        co.id AS client_order_id,
        co.number AS main_order_number,
        co.client_order_status,
        cod.order_detail_status,
        co.cost,
        co.payment_date,
        p.name AS package_name,
        si.name AS item_name,
        p.need_delivery
      FROM client_order_details cod
      JOIN client_orders co ON co.id = cod.client_order_id
      JOIN sale_items si ON si.id = cod.sale_item_id
      JOIN packages p ON p.id = si.package_id
      WHERE co.payment_date IS NOT NULL
        AND co.client_order_status IN (1, 2, 6)
        AND co.driver_id IS NULL
        AND (p.need_delivery = 0 OR p.need_delivery IS NULL)
        AND cod.sale_item_multi_distribution_group_id IS NULL
        AND cod.order_detail_status IN (1, 2, 6)
      ORDER BY co.payment_date DESC
      LIMIT ?
    `, [limit]);

    return orders;
  }
}

module.exports = VerifierService;
