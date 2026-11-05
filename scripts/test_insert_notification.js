const pool = require('../src/config/db');

async function testInsertNotification() {
  try {
    const userId = 1593074;
    console.log('--- Testing Notification Insert for User 1593074 ---');

    // 1. Subscription Reminder Notification
    const reminderTitle = {
      ar: 'تذكير اشتراك قطرات 💧',
      en: 'Qatarat Subscription Reminder 💧',
      id: 'Pengingat Langganan Qatarat 💧'
    };
    const reminderBody = {
      ar: 'اشتراكك الدوري نشط. سيتم معالجة وتجديد طلبك الدوري قريباً.',
      en: 'Your recurring subscription is active. Your upcoming order will be processed shortly.',
      id: 'Langganan berkala Anda aktif. Pesanan berkala Anda akan segera diproses secara otomatis.'
    };

    const [remRes] = await pool.query(`
      INSERT INTO user_notifications (
        user_id, active, type, title_tr, body_tr, created_at, updated_at
      ) VALUES (?, 1, 'subscription_reminder', ?, ?, NOW(), NOW())
    `, [
      userId,
      JSON.stringify(reminderTitle),
      JSON.stringify(reminderBody)
    ]);
    console.log('✅ Subscription Reminder Inserted, ID:', remRes.insertId);

    // 2. Subscription Order Generated Notification
    const orderNum = '261105' + Math.floor(100000 + Math.random() * 900000);
    const orderTitle = {
      ar: 'تم إنشاء طلب الاشتراك 📦',
      en: 'Subscription Order Created 📦',
      id: 'Pesanan Langganan Berhasil Dibuat 📦'
    };
    const orderBody = {
      ar: `تم إنشاء طلب اشتراكك رقم ${orderNum} بنجاح وهو قيد المتابعة والتنفيذ.`,
      en: `Your recurring subscription order #${orderNum} has been generated successfully.`,
      id: `Pesanan langganan Anda #${orderNum} telah berhasil dibuat dan dijadwalkan.`
    };

    const [orderNotifRes] = await pool.query(`
      INSERT INTO user_notifications (
        user_id, active, type, order_id, title_tr, body_tr, created_at, updated_at
      ) VALUES (?, 1, 'subscription_order_created', 1000675, ?, ?, NOW(), NOW())
    `, [
      userId,
      JSON.stringify(orderTitle),
      JSON.stringify(orderBody)
    ]);
    console.log('✅ Subscription Order Notification Inserted, ID:', orderNotifRes.insertId);

    // 3. Query back latest notifications for 1593074
    const [rows] = await pool.query(`
      SELECT id, user_id, type, order_id, title_tr, body_tr, created_at
      FROM user_notifications 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 4
    `, [userId]);

    console.log('\n--- Verified Recent Notifications for 1593074 ---');
    rows.forEach(r => {
      console.log(`\n🔔 Notification #${r.id} | Type: ${r.type} | Order: ${r.order_id || 'N/A'}`);
      console.log(`   🇮🇩 ID Title: ${r.title_tr ? r.title_tr.id : 'N/A'}`);
      console.log(`   🇮🇩 ID Body:  ${r.body_tr ? r.body_tr.id : 'N/A'}`);
      console.log(`   🇬🇧 EN Title: ${r.title_tr ? r.title_tr.en : 'N/A'}`);
      console.log(`   🇸🇦 AR Title: ${r.title_tr ? r.title_tr.ar : 'N/A'}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testInsertNotification();

