require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyOrder() {
  const pool = await mysql.createConnection({
    host: '13.215.213.102',
    port: 3306,
    user: 'qatarat-prod-db-replica-user',
    password: 'Kbzz8ef82K0tdJCHtCcG',
    database: 'qatarat-prod-db-replica'
  });

  const orderNumber = '260928721119';

  console.log('===============================================================');
  console.log(`🔍 VERIFYING ORDER #${orderNumber} IN ADMIN & CLOSE DISTRIBUTION`);
  console.log('===============================================================');

  // 1. Check in Order Management query (Admin Panel main list)
  const [orderMgmt] = await pool.query(`
    SELECT 
      co.id,
      co.number AS order_number,
      co.client_order_status,
      CASE 
        WHEN co.client_order_status = 2 THEN 'Payment Received (2)'
        WHEN co.client_order_status = 1 THEN 'Payment Received (1)'
        ELSE 'Other'
      END AS status_label,
      u.phone_number AS client_phone,
      co.payment_date,
      co.cost,
      co.payment_gateway,
      co.created_at
    FROM client_orders co
    LEFT JOIN users u ON u.id = co.client_id
    WHERE co.payment_date IS NOT NULL
      AND co.client_order_status IN (1, 2, 4)
    ORDER BY co.id DESC
    LIMIT 10
  `);

  console.log('\n📋 Top 10 Orders in Admin Order Management:');
  console.table(orderMgmt);

  // 2. Check 5-point Close Distribution rules for this order
  const [closeDistRows] = await pool.query(`
    SELECT 
      co.id AS client_order_id,
      co.number AS order_number,
      co.client_order_status,
      co.payment_date,
      co.driver_id,
      co.cost,
      p.id AS package_id,
      p.name AS package_name,
      p.need_delivery,
      cod.id AS order_detail_id,
      cod.order_detail_status,
      cod.sale_item_multi_distribution_group_id
    FROM client_orders co
    JOIN client_order_details cod ON cod.client_order_id = co.id
    JOIN sale_items si ON si.id = cod.sale_item_id
    JOIN packages p ON p.id = si.package_id
    WHERE co.number = ?
  `, [orderNumber]);

  console.log(`\n🎯 5-Point Validation Breakdown for Order #${orderNumber}:`);
  const row = closeDistRows[0];
  if (row) {
    const isPaid = (row.client_order_status === 1 || row.client_order_status === 2) && row.payment_date !== null;
    const noDriver = row.driver_id === null;
    const isCharity = row.need_delivery === 0 || row.need_delivery === null;
    const isOneTime = row.sale_item_multi_distribution_group_id === null;
    const notClosed = row.order_detail_status !== 3;

    console.log(`  1. Payment Received:    ${isPaid ? '✅ PASS' : '❌ FAIL'} (Status: ${row.client_order_status}, Payment Date: ${row.payment_date})`);
    console.log(`  2. No Driver Assigned:   ${noDriver ? '✅ PASS' : '❌ FAIL'} (driver_id: ${row.driver_id})`);
    console.log(`  3. Charity / Mosque:    ${isCharity ? '✅ PASS' : '❌ FAIL'} (need_delivery: ${row.need_delivery}, Package: ${row.package_name})`);
    console.log(`  4. One-Time Dist.:      ${isOneTime ? '✅ PASS' : '❌ FAIL'} (Group ID: ${row.sale_item_multi_distribution_group_id})`);
    console.log(`  5. Detail Not Closed:   ${notClosed ? '✅ PASS' : '❌ FAIL'} (order_detail_status: ${row.order_detail_status})`);

    const eligible = isPaid && noDriver && isCharity && isOneTime && notClosed;
    console.log(`\n👉 Close Distribution Status: ${eligible ? '🎉 ACTIVE & SEARCHABLE IN CLOSE DISTRIBUTION' : '⛔ NOT ELIGIBLE'}`);
  } else {
    console.log('❌ Order record not found in details join!');
  }

  // 3. Verify Payment Problems queue
  const [problems] = await pool.query('SELECT * FROM payment_problems WHERE client_order_id = ?', [row?.client_order_id || 998098]);
  console.log(`\n🔍 Remaining in Payment Problems: ${problems.length === 0 ? '✅ Cleared (0 items)' : '⚠️ Still present (' + problems.length + ' items)'}`);

  await pool.end();
}

verifyOrder();
