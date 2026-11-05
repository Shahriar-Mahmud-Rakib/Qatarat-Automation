const pool = require('../src/config/db');

async function inspectMore() {
  try {
    // 1. All rows of notification_translations
    const [allTrans] = await pool.query('SELECT * FROM notification_translations');
    console.log('--- ALL notification_translations ---');
    console.table(allTrans.map(t => ({
      id: t.id,
      type: t.type,
      title_id: t.title_tr ? t.title_tr.id : null,
      body_id: t.body_tr ? t.body_tr.id : null,
      title_ar: t.title_tr ? t.title_tr.ar : null,
      title_en: t.title_tr ? t.title_tr.en : null
    })));

    // 2. All rows of whatsapp_templates
    const [allWa] = await pool.query('SELECT * FROM whatsapp_templates');
    console.log('\n--- ALL whatsapp_templates ---');
    console.table(allWa);

    // 3. Check notifications table for client 1593074
    const [laravelNotifs] = await pool.query('SELECT * FROM notifications WHERE notifiable_id = 1593074 ORDER BY created_at DESC LIMIT 5');
    console.log('\n--- notifications (Laravel) for 1593074 ---', laravelNotifs);

    // 4. Check if there are any jobs in `jobs` table right now
    const [jobs] = await pool.query('SELECT * FROM jobs LIMIT 10');
    console.log('\n--- Active jobs in queue ---', jobs);

    // 5. Search failed_jobs for any job with subscription, reminder, or whatsapp
    const [failedWa] = await pool.query(`
      SELECT id, queue, payload, exception, failed_at 
      FROM failed_jobs 
      WHERE payload LIKE '%reminder%' OR payload LIKE '%subscription%' OR payload LIKE '%whatsapp%' OR payload LIKE '%notification%'
      ORDER BY id DESC LIMIT 5
    `);
    console.log('\n--- Failed jobs related to reminder/subscription/whatsapp ---');
    failedWa.forEach(f => {
      console.log(`Job ID: ${f.id}, Queue: ${f.queue}, Failed At: ${f.failed_at}`);
      try {
        const p = JSON.parse(f.payload);
        console.log(`  Job Name: ${p.displayName}`);
        console.log(`  Data: ${JSON.stringify(p.data).substring(0, 200)}`);
      } catch (e) {}
      console.log(`  Exception: ${f.exception.substring(0, 150)}...\n`);
    });

    // 6. Check subscription failed reasons across all subscriptions in DB
    const [subErrors] = await pool.query(`
      SELECT failed_reason, COUNT(*) as count 
      FROM subscriptions 
      WHERE failed_reason IS NOT NULL 
      GROUP BY failed_reason
    `);
    console.log('\n--- Subscriptions failed_reason breakdown ---');
    console.table(subErrors);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectMore();

