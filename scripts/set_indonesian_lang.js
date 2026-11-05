const pool = require('../src/config/db');

async function setIndonesianLanguage() {
  try {
    console.log('--- Updating user 1593074 to Indonesian (id: 4) ---');
    
    // 1. Update users.language = 4
    await pool.query('UPDATE users SET language = 4 WHERE id = 1593074');
    
    // 2. Update user_default_settings lang_code = 'id'
    await pool.query('UPDATE user_default_settings SET lang_code = "id" WHERE user_id = 1593074');

    // 3. Verify
    const [user] = await pool.query(`
      SELECT u.id, u.name, u.phone_number, u.language, l.name as lang_name, l.code as lang_code, uds.lang_code as default_lang
      FROM users u
      LEFT JOIN languages l ON l.id = u.language
      LEFT JOIN user_default_settings uds ON uds.user_id = u.id
      WHERE u.id = 1593074
    `);
    console.log('Updated user record:');
    console.table(user);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

setIndonesianLanguage();

