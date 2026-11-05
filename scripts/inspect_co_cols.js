const pool = require('../src/config/db');

async function inspectClientOrderCols() {
  try {
    const [cols] = await pool.query('DESCRIBE client_orders');
    const waCols = cols.filter(c => 
      c.Field.includes('whatsapp') || 
      c.Field.includes('sent') || 
      c.Field.includes('template') || 
      c.Field.includes('notif') ||
      c.Field.includes('reminder')
    );
    console.log('client_orders notification/whatsapp columns:');
    console.table(waCols);

    // Also check subscription columns
    const [subCols] = await pool.query('DESCRIBE subscriptions');
    const subWaCols = subCols.filter(c => 
      c.Field.includes('notify') || 
      c.Field.includes('reason') || 
      c.Field.includes('remind') ||
      c.Field.includes('whats')
    );
    console.log('subscriptions notification columns:');
    console.table(subWaCols);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectClientOrderCols();

