const pool = require('../src/config/db');

async function inspect() {
  try {
    console.log('--- Connecting to DB ---');
    // 1. Tables matching notification/subscription/whatsapp/job
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND (
          TABLE_NAME LIKE '%notif%' OR 
          TABLE_NAME LIKE '%subscrip%' OR 
          TABLE_NAME LIKE '%remind%' OR 
          TABLE_NAME LIKE '%job%' OR 
          TABLE_NAME LIKE '%whats%' OR
          TABLE_NAME LIKE '%sms%' OR
          TABLE_NAME LIKE '%msg%' OR
          TABLE_NAME LIKE '%template%'
        )
    `);
    console.log('Matching tables:', tables.map(t => t.TABLE_NAME));

    // 2. Describe subscriptions table
    const [subCols] = await pool.query('DESCRIBE subscriptions');
    console.log('\nSubscriptions columns:', subCols.map(c => `${c.Field} (${c.Type})`));

    // 3. User 1593074 details
    const [users] = await pool.query('SELECT id, name, phone_number, mobile_number, language, role FROM users WHERE phone_number LIKE "%1772173075%" OR id = 1593074');
    console.log('\nTarget user in DB:', users);

    // 4. Subscriptions for user 1593074
    const [userSubs] = await pool.query('SELECT * FROM subscriptions WHERE client_id = 1593074');
    console.log('\nSubscriptions for user 1593074:', userSubs);

    // 5. Check user_notifications table schema & recent entries
    const [notifCols] = await pool.query('DESCRIBE user_notifications');
    console.log('\nuser_notifications columns:', notifCols.map(c => `${c.Field} (${c.Type})`));

    const [userNotifs] = await pool.query('SELECT * FROM user_notifications WHERE user_id = 1593074 ORDER BY id DESC LIMIT 5');
    console.log('\nRecent user_notifications for user 1593074:', userNotifs);

    // 6. Check notifications table schema & recent entries
    const [notifMainCols] = await pool.query('DESCRIBE notifications');
    console.log('\nnotifications columns:', notifMainCols.map(c => `${c.Field} (${c.Type})`));

    // 7. Check notification_templates or notification_translations
    try {
      const [trans] = await pool.query('SELECT * FROM notification_translations LIMIT 10');
      console.log('\nnotification_translations samples:', trans);
    } catch (e) {
      console.log('notification_translations error:', e.message);
    }

    try {
      const [temps] = await pool.query('SELECT * FROM notification_templates LIMIT 10');
      console.log('\nnotification_templates samples:', temps);
    } catch (e) {
      console.log('notification_templates error:', e.message);
    }

    try {
      const [waTemps] = await pool.query('SELECT * FROM whatsapp_templates LIMIT 10');
      console.log('\nwhatsapp_templates samples:', waTemps);
    } catch (e) {
      console.log('whatsapp_templates error:', e.message);
    }

    // 8. Check failed_jobs
    try {
      const [failed] = await pool.query('SELECT id, queue, payload, exception, failed_at FROM failed_jobs ORDER BY id DESC LIMIT 3');
      console.log('\nLatest failed_jobs:');
      failed.forEach(f => {
        console.log(`- Job #${f.id} (Queue: ${f.queue})`);
        try {
          const p = JSON.parse(f.payload);
          console.log(`  DisplayName: ${p.displayName}`);
        } catch (_) {}
        console.log(`  Exception: ${f.exception.substring(0, 200)}...`);
      });
    } catch (e) {
      console.log('failed_jobs error:', e.message);
    }

  } catch (err) {
    console.error('Error during inspect:', err);
  } finally {
    await pool.end();
  }
}

inspect();

