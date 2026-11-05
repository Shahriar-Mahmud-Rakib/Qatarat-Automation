const PhoneModel = require('./phoneModel');
const PaymentModel = require('./paymentModel');
const CloseDistributionModel = require('./closeDistributionModel');
const SubscriptionModel = require('./subscriptionModel');
const pool = require('../config/db');

async function runFullQataratSuite() {
  console.log('================================================================================================');
  console.log('🌟 QATARAT MASTER SUITE: EXECUTING ALL 4 DISCRETE AUTOMATION MODELS SEQUENTIALLY');
  console.log('   1. Phone Model ➔ 2. Payment Model ➔ 3. Close Distribution Model ➔ 4. Subscription Model');
  console.log('================================================================================================\n');

  const summary = [];

  try {
    // 1. Phone Model
    console.log('▶️ [1/4] EXECUTING PHONE REFACTOR MODEL...');
    const phone = new PhoneModel({ closePool: false });
    const phonePass = await phone.runTests();
    summary.push({ model: '1. Phone & Auth Model', status: phonePass ? 'PASSED ✅' : 'FAILED ❌' });

    // 2. Payment Model
    console.log('\n▶️ [2/4] EXECUTING PAYMENT MODEL (HEADLESS)...');
    const payment = new PaymentModel({ headless: true, closePool: false });
    const paymentResult = await payment.runTest();
    summary.push({ model: '2. Payment Lifecycle Model', status: paymentResult?.status ? 'PASSED ✅' : 'FAILED ❌' });

    // 3. Close Distribution Model
    console.log('\n▶️ [3/4] EXECUTING CLOSE DISTRIBUTION MODEL...');
    const cd = new CloseDistributionModel({ closePool: false });
    const cdPass = await cd.runAudit();
    summary.push({ model: '3. Close Distribution Model', status: cdPass ? 'PASSED ✅' : 'FAILED ❌' });

    // 4. Subscription Model
    console.log('\n▶️ [4/4] EXECUTING SUBSCRIPTION MODEL...');
    const sub = new SubscriptionModel({ closePool: false });
    const subPass = await sub.runTests();
    summary.push({ model: '4. Subscription Model', status: subPass ? 'PASSED ✅' : 'FAILED ❌' });

  } finally {
    await pool.end();
  }

  console.log('\n================================================================================================');
  console.log('🏆 QATARAT MASTER SUITE EXECUTION SUMMARY');
  console.log('================================================================================================');
  console.table(summary);
  console.log('================================================================================================\n');

  return summary.every(s => s.status.includes('PASSED'));
}

if (require.main === module) {
  runFullQataratSuite()
    .then(pass => process.exit(pass ? 0 : 1))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runFullQataratSuite;
