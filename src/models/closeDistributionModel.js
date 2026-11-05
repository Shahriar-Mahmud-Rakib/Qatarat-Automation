require('dotenv').config();
const pool = require('../config/db');
const VerifierService = require('../services/verifierService');
const orderService = require('../services/orderService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

class CloseDistributionModel {
  constructor(options = {}) {
    this.closePool = options.closePool || false;
  }

  async runAudit() {
    console.log('================================================================================================');
    console.log('🕌 QATARAT CLOSE DISTRIBUTION MODEL: 5-POINT PREDICATE & ROUTING AUDIT');
    console.log('================================================================================================\n');

    const results = [];

    // 1. Predicate 1: Need Delivery = 0 Package Eligibility
    console.log('▶️ TEST 1: Package Need Delivery Flag Analysis');
    try {
      const [packages] = await pool.query(`
        SELECT id, name, need_delivery FROM packages WHERE active = 1 ORDER BY id ASC LIMIT 10
      `);
      console.log('   Sample active packages:');
      packages.forEach(p => {
        const isClose = p.need_delivery === 0 || p.need_delivery === null;
        console.log(`   - Package #${p.id} (${p.name}): need_delivery = ${p.need_delivery} => ${isClose ? '✅ CLOSE DISTRIBUTION' : '🚚 DRIVER DELIVERY'}`);
      });
      results.push({ test: 'Package Need Delivery Classification', status: 'PASSED', details: `${packages.length} packages audited` });
    } catch (err) {
      results.push({ test: 'Package Need Delivery Classification', status: 'FAILED', details: err.message });
    }

    // 2. Predicate 2: Driver Assigned Exclusion
    console.log('\n▶️ TEST 2: Driver Assignment Exclusion Predicate');
    try {
      const [driverOrders] = await pool.query(`
        SELECT co.id, co.number, co.driver_id, p.name as package_name
        FROM client_orders co
        JOIN client_order_details cod ON cod.client_order_id = co.id
        JOIN sale_items si ON si.id = cod.sale_item_id
        JOIN packages p ON p.id = si.package_id
        WHERE co.driver_id IS NOT NULL AND co.payment_date IS NOT NULL
        LIMIT 3
      `);
      let allExcluded = true;
      for (const ord of driverOrders) {
        const vis = await VerifierService.getOrderVisibility(ord.id);
        console.log(`   - Order #${ord.number} (Driver #${ord.driver_id}): inCloseDistribution = ${vis.inCloseDistribution ? 'YES ❌' : 'NO ✅ (Routed to Driver App)'}`);
        if (vis.inCloseDistribution) allExcluded = false;
      }
      results.push({ test: 'Driver Assignment Exclusion', status: allExcluded ? 'PASSED' : 'FAILED', details: 'Orders with driver excluded from Close Dist' });
    } catch (err) {
      results.push({ test: 'Driver Assignment Exclusion', status: 'FAILED', details: err.message });
    }

    // 3. Predicate 3: Unpaid Order Exclusion
    console.log('\n▶️ TEST 3: Unpaid Order Exclusion Predicate');
    try {
      const [unpaidOrders] = await pool.query(`
        SELECT co.id, co.number, co.client_order_status, co.payment_date
        FROM client_orders co
        WHERE co.payment_date IS NULL
        LIMIT 3
      `);
      let allUnpaidExcluded = true;
      for (const ord of unpaidOrders) {
        const vis = await VerifierService.getOrderVisibility(ord.id);
        console.log(`   - Unpaid Order #${ord.number}: inCloseDistribution = ${vis.inCloseDistribution ? 'YES ❌' : 'NO ✅ (Excluded until Paid)'}`);
        if (vis.inCloseDistribution) allUnpaidExcluded = false;
      }
      results.push({ test: 'Unpaid Order Exclusion', status: allUnpaidExcluded ? 'PASSED' : 'FAILED', details: 'Unpaid orders strictly excluded' });
    } catch (err) {
      results.push({ test: 'Unpaid Order Exclusion', status: 'FAILED', details: err.message });
    }

    // 4. Predicate 4: Multi-Day Recurring Distribution Exclusion
    console.log('\n▶️ TEST 4: Multi-Day (Recurring Friday) Exclusion Predicate');
    try {
      const [multiDist] = await pool.query(`
        SELECT cod.id, cod.client_order_id, cod.sale_item_multi_distribution_group_id
        FROM client_order_details cod
        WHERE cod.sale_item_multi_distribution_group_id IS NOT NULL
        LIMIT 3
      `);
      console.log(`   Found ${multiDist.length} multi-distribution sub-orders in DB.`);
      let multiExcluded = true;
      for (const d of multiDist) {
        const vis = await VerifierService.getOrderVisibility(d.client_order_id);
        if (vis.inCloseDistribution) multiExcluded = false;
      }
      results.push({ test: 'Multi-Day Distribution Routing', status: multiExcluded ? 'PASSED' : 'FAILED', details: 'Multi-dist routed to /multi-distribution' });
    } catch (err) {
      results.push({ test: 'Multi-Day Distribution Routing', status: 'FAILED', details: err.message });
    }

    // 5. Predicate 5: Closed / Delivered Orders Clean Filtering
    console.log('\n▶️ TEST 5: Delivered Order Detail Status = 3 Removal');
    try {
      const [delivered] = await pool.query(`
        SELECT cod.id, cod.client_order_id, cod.order_detail_status
        FROM client_order_details cod
        WHERE cod.order_detail_status = 3
        LIMIT 3
      `);
      let deliveredExcluded = true;
      for (const d of delivered) {
        const vis = await VerifierService.getOrderVisibility(d.client_order_id);
        if (vis.inCloseDistribution) deliveredExcluded = false;
      }
      results.push({ test: 'Delivered Order Detail Filtering', status: deliveredExcluded ? 'PASSED' : 'FAILED', details: 'Delivered orders removed from active queue' });
    } catch (err) {
      results.push({ test: 'Delivered Order Detail Filtering', status: 'FAILED', details: err.message });
    }

    console.log('\n================================================================================================');
    console.log('📊 CLOSE DISTRIBUTION 5-POINT AUDIT SUMMARY:');
    console.table(results);
    console.log('================================================================================================\n');

    if (this.closePool) await pool.end();
    return results.every(r => r.status === 'PASSED');
  }
}

if (require.main === module) {
  const model = new CloseDistributionModel({ closePool: true });
  model.runAudit()
    .then(pass => process.exit(pass ? 0 : 1))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = CloseDistributionModel;


