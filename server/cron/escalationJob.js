const cron = require('node-cron');
const db = require('../db');

// Run every hour — escalate doubts unanswered for 48 hours
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Running doubt escalation check...');
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const doubts = await db.query(
      `SELECT d.id, u.department FROM doubts d
       JOIN users u ON u.id = d.asker_id
       WHERE d.status = 'open' AND d.created_at < $1`, [cutoff]
    );
    for (const doubt of doubts.rows) {
      const faculty = await db.query(
        `SELECT id FROM users WHERE role = 'faculty' AND department = $1 AND is_active = true LIMIT 1`,
        [doubt.department]
      );
      const facultyId = faculty.rows[0]?.id || null;
      await db.query(
        `UPDATE doubts SET status = 'escalated', faculty_id = $1, escalated_at = NOW() WHERE id = $2`,
        [facultyId, doubt.id]
      );
      if (facultyId) {
        await db.query(
          `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'warning')`,
          [facultyId, `A student doubt has been escalated to you after 48 hours without a response.`]
        );
      }
    }
    if (doubts.rows.length > 0) {
      console.log(`[Cron] Escalated ${doubts.rows.length} doubt(s).`);
    }
  } catch (err) {
    console.error('[Cron] Escalation error:', err.message);
  }
});

console.log('[Cron] Doubt escalation job scheduled (every hour).');
