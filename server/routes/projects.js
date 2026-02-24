const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'ppt' || file.fieldname === 'report'
      ? path.join(__dirname, '../uploads/projects')
      : path.join(__dirname, '../uploads/projects');
    cb(null, dest);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const { status, department, search, limit = 30 } = req.query;
  try {
    let q = `SELECT p.*, u.name as uploader_name FROM projects p LEFT JOIN users u ON u.id = p.uploader_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND p.status = $${params.length}`; }
    if (department) { params.push(department); q += ` AND p.department = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (p.title ILIKE $${params.length} OR p.abstract ILIKE $${params.length})`; }
    params.push(parseInt(limit)); q += ` ORDER BY p.created_at DESC LIMIT $${params.length}`;
    const result = await db.query(q, params);
    res.json({ projects: result.rows });
  } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE uploader_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ projects: result.rows });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

router.post('/', auth, role('senior'), upload.fields([{ name: 'ppt', maxCount: 1 }, { name: 'report', maxCount: 1 }]), async (req, res) => {
  const { title, abstract, tech_stack, github_link, demo_video_link, department, team_members } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  try {
    const pptUrl = req.files?.ppt ? `/uploads/projects/${req.files.ppt[0].filename}` : null;
    const reportUrl = req.files?.report ? `/uploads/projects/${req.files.report[0].filename}` : null;
    let members = [];
    try { members = JSON.parse(team_members || '[]'); } catch {}
    const result = await db.query(
      `INSERT INTO projects (uploader_id, title, abstract, tech_stack, github_link, demo_video_link, ppt_url, report_pdf_url, team_members, department, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [req.user.id, title, abstract, tech_stack, github_link, demo_video_link, pptUrl, reportUrl, JSON.stringify(members), department]
    );
    const faculty = await db.query(`SELECT id FROM users WHERE role='faculty' AND department=$1 LIMIT 1`, [department]);
    if (faculty.rows[0]) {
      await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
        [faculty.rows[0].id, `New project "${title}" submitted by ${req.user.name} awaiting approval.`, 'info']);
    }
    res.status(201).json({ project: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: err.message || 'Upload failed' }); }
});

router.patch('/:id/approve', auth, role('faculty'), async (req, res) => {
  try {
    const proj = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ message: 'Not found' });
    await db.query('UPDATE projects SET status=$1, approved_by=$2 WHERE id=$3', ['approved', req.user.id, req.params.id]);
    const { awardPoints } = require('../utils/pointsHelper');
    await awardPoints(proj.rows[0].uploader_id, 'PROJECT_APPROVED', proj.rows[0].id, 'project');
    await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [proj.rows[0].uploader_id, `Your project "${proj.rows[0].title}" was approved! +15 points awarded.`, 'success']);
    res.json({ message: 'Approved' });
  } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

router.patch('/:id/reject', auth, role('faculty'), async (req, res) => {
  const { reason } = req.body;
  try {
    const proj = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ message: 'Not found' });
    await db.query('UPDATE projects SET status=$1, rejection_reason=$2 WHERE id=$3', ['rejected', reason, req.params.id]);
    await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [proj.rows[0].uploader_id, `Your project "${proj.rows[0].title}" was rejected. Reason: ${reason}`, 'warning']);
    res.json({ message: 'Rejected' });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

module.exports = router;
