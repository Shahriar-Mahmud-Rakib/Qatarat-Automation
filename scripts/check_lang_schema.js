const pool = require('../src/config/db');

async function checkLangSchema() {
  try {
    const [userCol] = await pool.query('DESCRIBE users');
    const langCol = userCol.find(c => c.Field === 'language');
    console.log('users.language column definition:', langCol);

    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND (TABLE_NAME LIKE '%lang%' OR TABLE_NAME LIKE '%locale%')
    `);
    console.log('Language tables:', tables.map(t => t.TABLE_NAME));

    for (const t of tables) {
      const [rows] = await pool.query(`SELECT * FROM ${t.TABLE_NAME}`);
      console.log(`\nTable ${t.TABLE_NAME}:`, rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkLangSchema();

