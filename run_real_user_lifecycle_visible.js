require('dotenv').config();
const RealUserOrderLifecycle = require('./src/modules/order_lifecycle/real_user_order_lifecycle');

async function main() {
  const runner = new RealUserOrderLifecycle({
    phone: process.env.ADMIN_PHONE || '8801772173075',
    headless: false, // Visible to user on their monitor
    display: ':0'
  });

  try {
    await runner.runFullJourney();
    process.exit(0);
  } catch (err) {
    console.error('Fatal Error during real user lifecycle:', err);
    process.exit(1);
  }
}

main();
