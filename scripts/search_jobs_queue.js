const pool = require('../src/config/db');

async function searchJobs() {
  try {
    const [jobs] = await pool.query('SELECT * FROM jobs');
    console.log('Current jobs in queue:', jobs.length);
    if (jobs.length > 0) {
      console.log(jobs);
    }

    const [failed] = await pool.query('SELECT * FROM failed_jobs ORDER BY id DESC LIMIT 5');
    console.log('\nRecent failed jobs:');
    failed.forEach(f => {
      console.log(`[Job #${f.id}] Queue: ${f.queue}`);
      try {
        const p = JSON.parse(f.payload);
        console.log('  DisplayName:', p.displayName);
        console.log('  Data:', p.data);
      } catch (e) {
        console.log('  Payload:', f.payload.substring(0, 150));
      }
      console.log('  Exception:', f.exception.substring(0, 200));
      console.log('-------------------------------------------');
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

searchJobs();

