const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// GET /api/users — faculty only
router.get('/', auth, role('faculty'), async (req, res) => {
  const { search, role: userRole, department } = req.query;
  try {
    let q = 'SELECT id, name, email, role, department, year, points, is_active, created_at FROM users WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    if (userRole) { params.push(userRole); q += ` AND role = $${params.length}`; }
    if (department) { params.push(department); q += ` AND department = $${params.length}`; }
    q += ' ORDER BY created_at DESC';
    const result = await db.query(q, params);
    res.json({ users: result.rows });
  } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

// PATCH /api/users/:id/toggle-active — faculty only
router.patch('/:id/toggle-active', auth, role('faculty'), async (req, res) => {
  const { is_active } = req.body;
  try {
    await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
    res.json({ message: 'User status updated' });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// GET /api/users/notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// PATCH /api/users/notifications/:id/read
router.patch('/notifications/:id/read', auth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false }); }
});

// PATCH /api/users/notifications/read-all
router.patch('/notifications/read-all', auth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false }); }
});

// GET /api/users/points — senior points + log
router.get('/points', auth, async (req, res) => {
  try {
    const user = await db.query('SELECT points FROM users WHERE id = $1', [req.user.id]);
    const log = await db.query(
      'SELECT * FROM points_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]
    );
    res.json({ points: user.rows[0]?.points || 0, log: log.rows });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

module.exports = router;
