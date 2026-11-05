const pool = require('../src/config/db');

async function testUserLang() {
  try {
    console.log('Testing update on user 1593074...');
    const [before] = await pool.query('SELECT id, name, phone_number, language FROM users WHERE id = 1593074');
    console.log('Before:', before);

    // Try update language
    try {
      const [res] = await pool.query('UPDATE users SET language = "id" WHERE id = 1593074');
      console.log('Update result:', res);
      const [after] = await pool.query('SELECT id, name, phone_number, language FROM users WHERE id = 1593074');
      console.log('After:', after);
    } catch (updateErr) {
      console.log('DB Update Error (read-only replica?):', updateErr.message);
    }

    // Also check user_default_settings for 1593074
    const [userSettings] = await pool.query('SELECT * FROM user_default_settings WHERE user_id = 1593074');
    console.log('user_default_settings for 1593074:', userSettings);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testUserLang();

