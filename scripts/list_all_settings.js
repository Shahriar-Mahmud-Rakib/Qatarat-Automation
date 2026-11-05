const pool = require('../src/config/db');

async function listSettings() {
  try {
    const [rows] = await pool.query('SELECT id, `key`, value, active FROM settings');
    console.log('--- ALL SETTINGS ---');
    rows.forEach(r => console.log(`[${r.id}] ${r.key} = "${r.value}" (active: ${r.active})`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listSettings();

