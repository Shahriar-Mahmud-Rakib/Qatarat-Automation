const pool = require('../src/config/db');

async function check() {
  try {
    const [rows] = await pool.query(`
      SELECT \`key\`, value FROM settings 
      WHERE value LIKE '%vercel%' 
         OR value LIKE '%qatarat%' 
         OR value LIKE '%prowhats%' 
         OR \`key\` LIKE '%url%' 
         OR \`key\` LIKE '%web%'
         OR \`key\` LIKE '%checkout%'
         OR \`key\` LIKE '%frontend%'
    `);
    console.log('Matching settings in DB:', rows.length);
    rows.forEach(r => console.log(r.key, '=>', r.value));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

check();

