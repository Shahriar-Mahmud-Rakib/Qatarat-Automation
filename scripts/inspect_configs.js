const pool = require('../src/config/db');

async function inspectConfigs() {
  try {
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND (
          TABLE_NAME LIKE '%sett%' OR 
          TABLE_NAME LIKE '%conf%' OR 
          TABLE_NAME LIKE '%param%' OR 
          TABLE_NAME LIKE '%api%' OR
          TABLE_NAME LIKE '%prov%'
        )
    `);
    console.log('Config/Setting tables:', tables.map(t => t.TABLE_NAME));

    for (const t of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${t.TABLE_NAME} LIMIT 5`);
        console.log(`\nTable ${t.TABLE_NAME}:`, rows);
      } catch (e) {
        console.log(`Table ${t.TABLE_NAME} error:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectConfigs();

