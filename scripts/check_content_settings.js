const pool = require('../src/config/db');

async function checkContentSettings() {
  try {
    const [rows] = await pool.query('SELECT id, `key`, title, content, content_tr FROM content_settings');
    console.log('--- content_settings ---');
    rows.forEach(r => {
      console.log(`ID: ${r.id} | Key: ${r.key} | Title: ${r.title}`);
      console.log(`Content: ${r.content}`);
      if (r.content_tr) {
        console.log(`Content_tr:`, JSON.stringify(r.content_tr, null, 2));
      }
      console.log('--------------------------------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkContentSettings();

