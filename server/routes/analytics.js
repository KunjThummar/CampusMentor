const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// GET /api/analytics/junior-stats
router.get('/junior-stats', auth, async (req, res) => {
  try {
    const [materials, projects, openDoubts, answeredDoubts] = await Promise.all([
      db.query("SELECT COUNT(*) FROM materials WHERE status='approved'"),
      db.query("SELECT COUNT(*) FROM projects WHERE status='approved'"),
      db.query("SELECT COUNT(*) FROM doubts WHERE asker_id=$1 AND status='open'", [req.user.id]),
      db.query("SELECT COUNT(*) FROM doubts WHERE asker_id=$1 AND status='answered'", [req.user.id])
    ]);
    res.json({
      materials: parseInt(materials.rows[0].count),
      projects: parseInt(projects.rows[0].count),
      openDoubts: parseInt(openDoubts.rows[0].count),
      answeredDoubts: parseInt(answeredDoubts.rows[0].count)
    });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// GET /api/analytics/senior-stats
router.get('/senior-stats', auth, async (req, res) => {
  try {
    // Fallback for department if not in token
    if (!req.user.department) {
      const u = await db.query('SELECT department FROM users WHERE id=$1', [req.user.id]);
      req.user.department = u.rows[0]?.department;
    }

    const [userRow, approved, pending, solved, assignedDoubts] = await Promise.all([
      db.query('SELECT points FROM users WHERE id=$1', [req.user.id]),
      db.query("SELECT COUNT(*) FROM materials WHERE uploader_id=$1 AND status='approved'", [req.user.id]),
      db.query("SELECT COUNT(*) FROM materials WHERE uploader_id=$1 AND status='pending' UNION ALL SELECT COUNT(*) FROM projects WHERE uploader_id=$1 AND status='pending'"),
      db.query("SELECT COUNT(*) FROM doubts WHERE answered_by=$1 AND status='answered'", [req.user.id]),
      db.query("SELECT COUNT(*) FROM doubts WHERE status='open' AND (assigned_senior_id=$1 OR department=$2)", [req.user.id, req.user.department])
    ]);
    const pendingCount = pending.rows.reduce((s, r) => s + parseInt(r.count), 0);
    res.json({
      points: userRow.rows[0]?.points || 0,
      approved: parseInt(approved.rows[0].count),
      pending: pendingCount,
      solved: parseInt(solved.rows[0].count),
      assignedDoubts: parseInt(assignedDoubts.rows[0].count)
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed' }); }
});

// GET /api/analytics/faculty-stats
router.get('/faculty-stats', auth, role('faculty'), async (req, res) => {
  try {
    const [pendingMats, pendingProjs, activeUsers, totalMats, totalProjs, escalated, seniors] = await Promise.all([
      db.query("SELECT COUNT(*) FROM materials WHERE status='pending'"),
      db.query("SELECT COUNT(*) FROM projects WHERE status='pending'"),
      db.query("SELECT COUNT(*) FROM users WHERE is_active=true"),
      db.query("SELECT COUNT(*) FROM materials"),
      db.query("SELECT COUNT(*) FROM projects"),
      db.query("SELECT COUNT(*) FROM doubts WHERE status='escalated'"),
      db.query("SELECT COUNT(*) FROM users WHERE role='senior'")
    ]);
    res.json({
      pending: parseInt(pendingMats.rows[0].count) + parseInt(pendingProjs.rows[0].count),
      pendingMaterials: parseInt(pendingMats.rows[0].count),
      pendingProjects: parseInt(pendingProjs.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      materials: parseInt(totalMats.rows[0].count),
      projects: parseInt(totalProjs.rows[0].count),
      escalated: parseInt(escalated.rows[0].count),
      seniors: parseInt(seniors.rows[0].count)
    });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// GET /api/analytics/faculty-full
router.get('/faculty-full', auth, role('faculty'), async (req, res) => {
  try {
    const [mentors, topMats, deptEng, escalatedDoubts] = await Promise.all([
      db.query("SELECT name, points FROM users WHERE role='senior' ORDER BY points DESC LIMIT 5"),
      db.query("SELECT title, views FROM materials WHERE status='approved' ORDER BY views DESC LIMIT 5"),
      db.query(`SELECT department, COUNT(*) as count FROM (
        SELECT department FROM materials WHERE status='approved'
        UNION ALL SELECT department FROM projects WHERE status='approved'
      ) t GROUP BY department ORDER BY count DESC`),
      db.query(`SELECT d.*, u.name as asker_name FROM doubts d LEFT JOIN users u ON u.id=d.asker_id WHERE d.status='escalated' ORDER BY d.escalated_at DESC LIMIT 10`)
    ]);
    res.json({
      topMentors: mentors.rows,
      topMaterials: topMats.rows,
      deptEngagement: deptEng.rows,
      escalatedDoubts: escalatedDoubts.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed' }); }
});

module.exports = router;
