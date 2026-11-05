const pool = require('../src/config/db');

async function findWhatsAppCode() {
  try {
    // 1. Check all tables with log, sms, wa, message, send
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND (
          TABLE_NAME LIKE '%log%' OR 
          TABLE_NAME LIKE '%msg%' OR 
          TABLE_NAME LIKE '%mess%' OR 
          TABLE_NAME LIKE '%outbox%' OR
          TABLE_NAME LIKE '%queue%' OR
          TABLE_NAME LIKE '%history%' OR
          TABLE_NAME LIKE '%whats%'
        )
    `);
    console.log('Matching tables:', tables.map(t => t.TABLE_NAME));

    for (const t of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${t.TABLE_NAME} ORDER BY id DESC LIMIT 2`);
        console.log(`\nTable ${t.TABLE_NAME} sample:`, rows);
      } catch (e) {
        console.log(`Table ${t.TABLE_NAME} error:`, e.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

findWhatsAppCode();

