const pool = require('../src/config/db');

async function inspectPackages() {
  try {
    const [pkgs] = await pool.query('SELECT id, name, whatsapp_template_id, need_delivery FROM packages LIMIT 10');
    console.log('Packages:');
    console.table(pkgs);

    const [subDetails] = await pool.query(`
      SELECT sd.*, p.name as pkg_name, p.whatsapp_template_id 
      FROM subscription_details sd
      JOIN packages p ON p.id = sd.package_id
      WHERE sd.subscription_id = 9235
    `);
    console.log('\nSubscription 9235 details:');
    console.table(subDetails);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectPackages();

