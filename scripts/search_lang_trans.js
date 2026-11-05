const pool = require('../src/config/db');

async function searchLangTrans() {
  try {
    const [rows] = await pool.query(`
      SELECT lt.id, lt.language_id, l.code, lt.app_name, lt.group, lt.key, lt.value
      FROM language_translations lt
      JOIN languages l ON l.id = lt.language_id
      WHERE lt.key LIKE '%subscri%' OR lt.key LIKE '%notif%' OR lt.key LIKE '%remind%'
    `);
    console.log(`Found ${rows.length} matching rows in language_translations:`);
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

searchLangTrans();

