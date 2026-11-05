const pool = require('../src/config/db');

async function searchProviders() {
  try {
    const [settings] = await pool.query('SELECT * FROM settings');
    console.log('All settings rows:');
    console.table(settings);

    const [siteConfigs] = await pool.query('SELECT * FROM site_configurations');
    console.log('Site configs:');
    console.table(siteConfigs);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

searchProviders();

