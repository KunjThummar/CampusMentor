const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// GET /api/doubts/my — asker's doubts
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.name as answerer_name FROM doubts d LEFT JOIN users u ON u.id = d.answered_by
       WHERE d.asker_id = $1 ORDER BY d.created_at DESC`, [req.user.id]
    );
    res.json({ doubts: result.rows });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// GET /api/doubts/assigned — senior's assigned doubts
router.get('/assigned', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.name as asker_name FROM doubts d LEFT JOIN users u ON u.id = d.asker_id
       WHERE d.assigned_senior_id = $1 ORDER BY d.created_at DESC`, [req.user.id]
    );
    res.json({ doubts: result.rows });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// POST /api/doubts — submit new doubt
router.post('/', auth, async (req, res) => {
  const { subject, department, question } = req.body;
  if (!question || question.length < 20) return res.status(400).json({ message: 'Question must be at least 20 characters' });
  try {
    // Find random active senior in same department
    const seniorResult = await db.query(
      `SELECT id FROM users WHERE role='senior' AND department=$1 AND is_active=true ORDER BY RANDOM() LIMIT 1`,
      [department || req.user.department]
    );
    const assignedSeniorId = seniorResult.rows[0]?.id || null;

    // If no senior found, find faculty
    let facultyId = null;
    if (!assignedSeniorId) {
      const facultyResult = await db.query(
        `SELECT id FROM users WHERE role='faculty' AND department=$1 AND is_active=true LIMIT 1`,
        [department || req.user.department]
      );
      facultyId = facultyResult.rows[0]?.id || null;
    }

    const result = await db.query(
      `INSERT INTO doubts (asker_id, assigned_senior_id, faculty_id, subject, department, question)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, assignedSeniorId, facultyId, subject, department, question]
    );

    // Notify assigned senior
    if (assignedSeniorId) {
      await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
        [assignedSeniorId, `You have a new doubt assigned: "${question.slice(0,60)}..."`, 'info']);
    }

    res.status(201).json({ doubt: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to submit doubt' }); }
});

// PATCH /api/doubts/:id/answer — senior answers
router.patch('/:id/answer', auth, async (req, res) => {
  const { answer } = req.body;
  if (!answer || answer.length < 10) return res.status(400).json({ message: 'Answer too short' });
  try {
    const doubt = await db.query('SELECT * FROM doubts WHERE id = $1', [req.params.id]);
    if (!doubt.rows.length) return res.status(404).json({ message: 'Doubt not found' });
    if (doubt.rows[0].assigned_senior_id !== req.user.id && doubt.rows[0].faculty_id !== req.user.id)
      return res.status(403).json({ message: 'Not assigned to you' });

    await db.query('UPDATE doubts SET status=$1, answer=$2, answered_by=$3 WHERE id=$4',
      ['answered', answer, req.user.id, req.params.id]);

    // Award points to senior
    if (req.user.role === 'senior') {
      const { awardPoints } = require('../utils/pointsHelper');
      await awardPoints(req.user.id, 'DOUBT_SOLVED', doubt.rows[0].id, 'doubt');
    }

    // Notify asker
    await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [doubt.rows[0].asker_id, `Your doubt has been answered! Check "My Doubts" to see the answer.`, 'success']);

    res.json({ message: 'Answer submitted successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed' }); }
});

module.exports = router;
