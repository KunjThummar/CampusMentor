const db = require('../db');

const POINTS = {
  MATERIAL_APPROVED: 10,
  PROJECT_APPROVED: 15,
  DOUBT_SOLVED: 5
};

async function awardPoints(userId, action, referenceId, referenceType) {
  const pts = POINTS[action];
  if (!pts) return;
  await db.query('UPDATE users SET points = points + $1 WHERE id = $2', [pts, userId]);
  await db.query(
    'INSERT INTO points_log (user_id, action, points_earned, reference_id, reference_type) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, pts, referenceId, referenceType]
  );
  // Check for 100-point threshold -> auto generate certificate
  const result = await db.query('SELECT points FROM users WHERE id = $1', [userId]);
  if (result.rows[0]?.points >= 100) {
    const existing = await db.query('SELECT id FROM certificates WHERE user_id = $1', [userId]);
    if (!existing.rows.length) {
      const { generateCertificate } = require('./certificateGenerator');
      await generateCertificate(userId);
    }
  }
}

module.exports = { awardPoints, POINTS };
