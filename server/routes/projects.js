const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/projects');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '-' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Helper to handle multer errors and return JSON
function handleProjectUpload(req, res, next) {
  upload.fields([
    { name: 'ppt', maxCount: 1 },
    { name: 'report', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}

// GET /api/projects — public with filters
router.get('/', async (req, res) => {
  const { status, department, search, limit = 30, offset = 0 } = req.query;
  try {
    let q = `SELECT p.*, u.name as uploader_name FROM projects p LEFT JOIN users u ON u.id = p.uploader_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND p.status = $${params.length}`; }
    if (department) { params.push(department); q += ` AND p.department = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.title ILIKE $${params.length} OR p.abstract ILIKE $${params.length})`;
    }
    params.push(parseInt(limit)); q += ` ORDER BY p.created_at DESC LIMIT $${params.length}`;
    params.push(parseInt(offset)); q += ` OFFSET $${params.length}`;
    const result = await db.query(q, params);
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('GET /projects error:', err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// GET /api/projects/my — own uploads
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM projects WHERE uploader_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('GET /projects/my error:', err);
    res.status(500).json({ message: 'Failed to fetch your projects' });
  }
});

// POST /api/projects — upload (senior only)
router.post('/', auth, role('senior'), handleProjectUpload, async (req, res) => {
  const { title, abstract, tech_stack, github_link, demo_video_link, department, team_members } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Project title is required' });
  }

  try {
    const pptUrl = req.files?.ppt ? `/uploads/projects/${req.files.ppt[0].filename}` : null;
    const reportUrl = req.files?.report ? `/uploads/projects/${req.files.report[0].filename}` : null;

    let members = [];
    try { members = JSON.parse(team_members || '[]'); } catch { members = []; }

    const result = await db.query(
      `INSERT INTO projects (uploader_id, title, abstract, tech_stack, github_link, demo_video_link, ppt_url, report_pdf_url, team_members, department, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [
        req.user.id,
        title.trim(),
        abstract || null,
        tech_stack || null,
        github_link || null,
        demo_video_link || null,
        pptUrl,
        reportUrl,
        JSON.stringify(members),
        department || null
      ]
    );

    // Notify faculty
    try {
      const dept = department || req.user.department;
      if (dept) {
        const faculty = await db.query(
          `SELECT id FROM users WHERE role='faculty' AND department=$1 AND is_active=true LIMIT 1`,
          [dept]
        );
        if (faculty.rows[0]) {
          await db.query(
            'INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
            [faculty.rows[0].id, `New project "${title.trim()}" submitted by ${req.user.name} awaiting approval.`, 'info']
          );
        }
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    res.status(201).json({ project: result.rows[0], message: 'Project uploaded! Awaiting faculty approval.' });
  } catch (err) {
    console.error('POST /projects error:', err);
    res.status(500).json({ message: 'Upload failed: ' + (err.message || 'Unknown error') });
  }
});

// PATCH /api/projects/:id/approve — faculty only
router.patch('/:id/approve', auth, role('faculty'), async (req, res) => {
  try {
    const proj = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ message: 'Project not found' });
    await db.query(
      'UPDATE projects SET status=$1, approved_by=$2 WHERE id=$3',
      ['approved', req.user.id, req.params.id]
    );
    const { awardPoints } = require('../utils/pointsHelper');
    await awardPoints(proj.rows[0].uploader_id, 'PROJECT_APPROVED', proj.rows[0].id, 'project');
    await db.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [proj.rows[0].uploader_id, `Your project "${proj.rows[0].title}" was approved! +15 points awarded.`, 'success']
    );
    res.json({ message: 'Approved' });
  } catch (err) {
    console.error('PATCH /projects/:id/approve error:', err);
    res.status(500).json({ message: 'Approval failed' });
  }
});

// PATCH /api/projects/:id/reject — faculty only
router.patch('/:id/reject', auth, role('faculty'), async (req, res) => {
  const { reason } = req.body;
  try {
    const proj = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows.length) return res.status(404).json({ message: 'Project not found' });
    await db.query(
      'UPDATE projects SET status=$1, rejection_reason=$2 WHERE id=$3',
      ['rejected', reason || 'No reason provided', req.params.id]
    );
    await db.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [proj.rows[0].uploader_id, `Your project "${proj.rows[0].title}" was rejected. Reason: ${reason || 'No reason provided'}`, 'warning']
    );
    res.json({ message: 'Rejected' });
  } catch (err) {
    console.error('PATCH /projects/:id/reject error:', err);
    res.status(500).json({ message: 'Failed to reject project' });
  }
});

// PATCH /api/projects/:id/view — increment view count
router.patch('/:id/view', async (req, res) => {
  try {
    await db.query('UPDATE projects SET views = views + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

module.exports = router;
