const pool = require('../src/config/db');

async function checkNotifyMethods() {
  try {
    const [methods] = await pool.query('SELECT notify_method, COUNT(*) as cnt FROM subscriptions GROUP BY notify_method');
    console.log('Notify methods in subscriptions:');
    console.table(methods);

    const [types] = await pool.query('SELECT subscription_type, COUNT(*) as cnt FROM subscriptions GROUP BY subscription_type');
    console.log('Subscription types:');
    console.table(types);

    const [notifTypes] = await pool.query('SELECT type, COUNT(*) as cnt FROM user_notifications GROUP BY type');
    console.log('User notification types in user_notifications:');
    console.table(notifTypes);

    const [notifLaravelTypes] = await pool.query('SELECT type, COUNT(*) as cnt FROM notifications GROUP BY type');
    console.log('Laravel notification types:');
    console.table(notifLaravelTypes);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkNotifyMethods();

