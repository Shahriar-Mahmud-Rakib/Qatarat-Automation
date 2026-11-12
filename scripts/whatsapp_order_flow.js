// ==============================================================================
// 📱 QATARAT WHATSAPP ORDER & 1-CLICK CHECKOUT LINK GENERATOR CLI
// Usage:
//   node scripts/whatsapp_order_flow.js [PHONE] [PATH] [SERVICE] [QUANTITY] [--pay]
//
// Examples:
//   node scripts/whatsapp_order_flow.js 01772173075 mosques water 50
//   node scripts/whatsapp_order_flow.js 01772173075 grand_mosque meals 100
//   node scripts/whatsapp_order_flow.js +8801634319696 mosques water 30
//   node scripts/whatsapp_order_flow.js 01772173075 mosques water 50 --pay
// ==============================================================================

require('dotenv').config();
const axios = require('axios');
const pool = require('../src/config/db');

function normalizePhone(input) {
  const digits = String(input || '01772173075').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.substring(2)}`;
  if (digits.startsWith('01') && digits.length === 11) return `+88${digits}`;
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('05') && digits.length === 10) return `+966${digits.substring(1)}`;
  return `+${digits}`;
}

async function runWhatsAppOrder() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const isAutoPay = process.argv.includes('--pay');

  const rawPhone = args[0] || '01772173075';
  const path = (args[1] || 'mosques').toLowerCase(); // 'mosques' | 'grand_mosque'
  const service = (args[2] || 'water').toLowerCase(); // 'water' | 'meals'
  const quantity = parseInt(args[3] || '50', 10);

  const phone = normalizePhone(rawPhone);
  const baseApi = process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';
  const endpoint = `${baseApi}/api/whatsapp/order`;

  console.log('================================================================================');
  console.log('📱 QATARAT WHATSAPP 1-CLICK ORDER & CHECKOUT GENERATOR');
  console.log('================================================================================\n');

  console.log(`📌 Customer Phone:   ${phone} (Input: ${rawPhone})`);
  console.log(`📌 Destination Path: ${path} (${path === 'grand_mosque' ? 'الحرم المكي (Grand Mosque)' : 'مساجد مكة (Mecca Mosques)'})`);
  console.log(`📌 Service Type:     ${service} (${service === 'water' ? 'سقيا الماء (Water)' : 'إطعام / وجبات (Meals)'})`);
  console.log(`📌 Quantity:         ${quantity} units`);
  console.log(`📡 API Endpoint:     ${endpoint}\n`);

  // ----------------------------------------------------------------------------
  // STEP 1: Query List Packages
  // ----------------------------------------------------------------------------
  console.log('--- STEP 1: Checking Available Package Catalog ---');
  let availablePackages = [];
  try {
    const pkgRes = await axios.post(endpoint, { action: 'list_packages' });
    availablePackages = pkgRes.data?.data || [];
    console.log(`✅ Loaded ${availablePackages.length} packages from WhatsApp Ordering API.`);
  } catch (err) {
    console.warn('⚠️ Could not load package catalog:', err.message);
  }

  // Find exact matching package if possible
  const matched = availablePackages.find(p => p.path === path && p.service === service && p.quantity === quantity);
  if (matched) {
    console.log(`🎯 Matched Catalog Item: "${matched.package_name_en} - ${matched.sale_item_name_en}" | Base Price: ${matched.price} SAR`);
  }

  // ----------------------------------------------------------------------------
  // STEP 2: Create WhatsApp Draft Order & Checkout URL
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 2: Calling WhatsApp Order API (action: create_draft) ---');
  const sessionId = `wa_session_${Date.now()}`;
  const payload = {
    action: 'create_draft',
    session_id: sessionId,
    phone,
    path,
    service,
    quantity
  };

  let orderData = null;
  try {
    const res = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 20000
    });
    orderData = res.data;
    console.log('✅ Draft Order Created Successfully!');
  } catch (err) {
    console.error('❌ API Call Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  const {
    draft_id,
    order_number,
    order_uid,
    checkout_url,
    checkout_token_expires_at,
    order_summary,
    customer
  } = orderData;

  // ----------------------------------------------------------------------------
  // STEP 3: Verify Draft Order in MySQL Database
  // ----------------------------------------------------------------------------
  console.log('\n--- STEP 3: Verifying Database Persistence ---');
  const [dbOrder] = await pool.query(
    'SELECT id, number, uid, client_id, client_order_status, cost, payment_gateway, created_at FROM client_orders WHERE id = ?',
    [draft_id]
  );

  console.log('📋 Database Client Order Record:');
  console.table(dbOrder);

  // ----------------------------------------------------------------------------
  // STEP 4: Optional Auto-Payment Reconcile (--pay)
  // ----------------------------------------------------------------------------
  if (isAutoPay) {
    console.log('\n--- STEP 4: Simulating & Confirming Payment (--pay flag provided) ---');
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(`
      UPDATE client_orders 
      SET client_order_status = 2,
          payment_date = ?,
          payment_gateway = 'whatsapp_direct_mada',
          auto_reconcile_attempted = 1,
          updated_at = NOW()
      WHERE id = ?
    `, [nowStr, draft_id]);

    await pool.query(`
      UPDATE client_order_details 
      SET order_detail_status = 2,
          updated_at = NOW()
      WHERE client_order_id = ?
    `, [draft_id]);

    console.log(`✅ Order #${order_number} marked as PAID (status: 2, gateway: whatsapp_direct_mada)`);
  }

  // ----------------------------------------------------------------------------
  // STEP 5: Formatted WhatsApp Message Ready to Send / Click
  // ----------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('💬 GENERATED WHATSAPP MESSAGE (READY FOR CUSTOMER CHAT)');
  console.log('================================================================================\n');

  const waMessage = `
أهلاً بك في منصة قطرات 💧
Welcome to Qatarat Platform!

تم تجهيز مسودة طلبك بنجاح عبر الواتساب:
Your WhatsApp draft order has been created successfully:

📦 رقم الطلب (Order #): *${order_number}*
📍 الوجهة (Destination): *${path === 'grand_mosque' ? 'الحرم المكي الشريف' : 'مساجد مكة المكرمة'}*
🏷️ الخدمة (Service): *${service === 'water' ? 'سقيا الماء (Water Distribution)' : 'إطعام / وجبات (Meals)'}*
🔢 الكمية (Quantity): *${order_summary.quantity} ${service === 'water' ? 'كرتون (Cartons)' : 'وجبة (Meals)'}*

💰 ملخص الدفع (Price Breakdown):
 - القيمة الأساسية (Subtotal): ${order_summary.sub_total} SAR
 - الضريبة (VAT 15%): ${order_summary.tax || 0} SAR
 - رسوم التوصيل (Delivery): ${order_summary.delivery_fee || 0} SAR
 ------------------------------------
 ⭐ *المجموع الكلي (Total): ${order_summary.total_cost} ${order_summary.currency}*

🔗 *رابط إتمام الطلب والدفع الفوري (1-Click Checkout Link):*
${checkout_url}

*(الرابط فعال لمدة ساعتين - صلاحية التوكن: ${new Date(checkout_token_expires_at).toLocaleTimeString()})*
*(Link valid for 2 hours - Auto-logs into checkout without password)*
`;

  console.log(waMessage.trim());

  console.log('\n================================================================================');
  console.log('🎯 SUMMARY LINK DETAILS:');
  console.log('================================================================================');
  console.log(`🔗 Clickable Checkout Link:`);
  console.log(`   ${checkout_url}\n`);
  console.log(`Order Number: ${order_number} | Draft ID: ${draft_id} | Total: ${order_summary.total_cost} SAR`);
  console.log('================================================================================\n');

  await pool.end();
  return {
    orderNumber: order_number,
    draftId: draft_id,
    checkoutUrl: checkout_url,
    totalCost: order_summary.total_cost
  };
}

runWhatsAppOrder().catch(err => {
  console.error('Execution Error:', err);
  pool.end();
  process.exit(1);
});
