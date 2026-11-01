require('dotenv').config();
const { getTemplate, listTemplates } = require('./src/config/templates');
const orderService = require('./src/services/orderService');
const subscriptionService = require('./src/services/subscriptionService');
const pool = require('./src/config/db');

const templateName = process.argv[2];

async function main() {
  if (!templateName || templateName === 'list' || templateName === 'help') {
    console.log('\n================================================================================');
    console.log('📋 AVAILABLE AUTOMATION PRESET TEMPLATES');
    console.log('================================================================================\n');
    const templates = listTemplates();
    templates.forEach((t, i) => {
      console.log(`${i + 1}. [${t.name}]`);
      console.log(`   Title:       ${t.title}`);
      console.log(`   Description: ${t.description}`);
      console.log(`   Type:        ${t.type.toUpperCase()}`);
      console.log(`   Run:         node index.js template ${t.name}\n`);
    });
    process.exit(0);
  }

  const template = getTemplate(templateName);
  if (!template) {
    console.error(`❌ Unknown template: "${templateName}". Run "node index.js templates" to see all available templates.`);
    process.exit(1);
  }

  console.log('================================================================================');
  console.log(`🚀 EXECUTING TEMPLATE: ${template.title.toUpperCase()}`);
  console.log(`📝 Description: ${template.description}`);
  console.log('================================================================================');

  try {
    if (template.type === 'orders') {
      const results = await orderService.runFlexibleOrders(template.options);
      console.log('\n================================================================================');
      console.log('📊 EXECUTION SUMMARY REPORT');
      console.log('================================================================================');
      console.table(results.map((r, idx) => ({
        '#': idx + 1,
        'User': r.customer ? r.customer.slice(0, 20) : 'Single User',
        'Order #': r.orderNumber,
        'Package / Item': `${r.package_name || 'N/A'} (${r.item_name || 'N/A'})`.slice(0, 30),
        'Cost': `${r.cost} SAR`,
        'Close Dist': r.inCloseDistribution ? '✅ YES' : '❌ NO',
        'Set Order': r.inSetOrder ? '✅ YES' : '❌ NO'
      })));

      const closeDistCount = results.filter(r => r.inCloseDistribution).length;
      console.log(`\n🎯 Completed: ${results.length} total orders | ${closeDistCount} in Close Distribution ✅`);

    } else if (template.type === 'subscription') {
      const results = await subscriptionService.runFlexibleSubscriptionTest(template.options);
      console.log('\n================================================================================');
      console.log('📊 MULTI-USER SUBSCRIPTION SUMMARY REPORT');
      console.log('================================================================================');
      console.table(results.map((r, idx) => ({
        '#': idx + 1,
        'Sub ID': r.subscriptionId,
        'Phone': r.userPhone,
        'Generated Order #': r.orderNumber,
        'Cost': `${r.cost} SAR`,
        'Close Dist': r.inCloseDistribution ? '✅ YES' : '❌ NO',
        'Next Cycle': r.nextGenerateDate ? new Date(r.nextGenerateDate).toISOString().split('T')[0] : 'N/A'
      })));

      const successCount = results.filter(r => r.inCloseDistribution).length;
      console.log(`\n🎯 Completed: ${results.length} subscribers | ${successCount} successfully routed to Close Distribution ✅`);

    } else if (template.type === 'subscription-single') {
      const res = await subscriptionService.runSingleSubscriptionTest(template.options.subscriptionId, template.options.targetDate);
      console.log('\n================================================================================');
      console.log('📊 SINGLE SUBSCRIPTION REPORT');
      console.log('================================================================================');
      console.table([{
        'Sub ID': res.subscriptionId,
        'Order #': res.orderNumber,
        'Suborder ID': res.suborderId,
        'Close Dist': res.inCloseDistribution ? '✅ YES' : '❌ NO',
        'Next Cycle': res.nextGenerateDate ? new Date(res.nextGenerateDate).toISOString().split('T')[0] : 'N/A'
      }]);
    }

  } catch (err) {
    console.error('❌ Template execution failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
