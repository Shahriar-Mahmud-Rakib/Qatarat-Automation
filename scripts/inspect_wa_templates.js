const pool = require('../src/config/db');

async function inspectWaTemplates() {
  try {
    const [cols] = await pool.query('DESCRIBE whatsapp_templates');
    console.log('whatsapp_templates columns:', cols);

    const [rows] = await pool.query('SELECT * FROM whatsapp_templates');
    console.log('whatsapp_templates rows:');
    console.table(rows);

    const [subTemplates] = await pool.query(`
      SELECT * FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE '%template%'
    `);
    console.log('Columns matching template:', subTemplates.map(c => `${c.TABLE_NAME}.${c.COLUMN_NAME}`));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectWaTemplates();

