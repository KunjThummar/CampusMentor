const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/materials');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX allowed.'));
    }
  }
});

// Helper to handle multer errors and return JSON
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
    }
    next();
  });
}

// GET /api/materials — public with filters
router.get('/', async (req, res) => {
  const { status, subject, department, search, limit = 30, offset = 0 } = req.query;
  try {
    let q = `SELECT m.*, u.name as uploader_name FROM materials m LEFT JOIN users u ON u.id = m.uploader_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND m.status = $${params.length}`; }
    if (subject) { params.push(subject); q += ` AND m.subject = $${params.length}`; }
    if (department) { params.push(department); q += ` AND m.department = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (m.title ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
    }
    params.push(parseInt(limit)); q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
    params.push(parseInt(offset)); q += ` OFFSET $${params.length}`;
    const result = await db.query(q, params);
    res.json({ materials: result.rows });
  } catch (err) {
    console.error('GET /materials error:', err);
    res.status(500).json({ message: 'Failed to fetch materials' });
  }
});

// GET /api/materials/my — own uploads (must be before /:id routes)
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM materials WHERE uploader_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ materials: result.rows });
  } catch (err) {
    console.error('GET /materials/my error:', err);
    res.status(500).json({ message: 'Failed to fetch your materials' });
  }
});

// POST /api/materials — upload (senior only)
router.post('/', auth, role('senior'), handleUpload, async (req, res) => {
  const { title, subject, department, year, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Please attach a file (PDF, DOC, or PPTX)' });
  }

  try {
    const fileUrl = `/uploads/materials/${req.file.filename}`;
    const result = await db.query(
      `INSERT INTO materials (uploader_id, title, subject, department, year, file_url, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [req.user.id, title.trim(), subject || null, department || null, year ? parseInt(year) : null, fileUrl, description || null]
    );

    // Notify faculty in same department
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
            [faculty.rows[0].id, `New material "${title.trim()}" submitted by ${req.user.name} awaiting your approval.`, 'info']
          );
        }
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    res.status(201).json({ material: result.rows[0], message: 'Material uploaded! Awaiting faculty approval.' });
  } catch (err) {
    console.error('POST /materials error:', err);
    res.status(500).json({ message: 'Upload failed: ' + (err.message || 'Unknown error') });
  }
});

// PATCH /api/materials/:id/approve — faculty only
router.patch('/:id/approve', auth, role('faculty'), async (req, res) => {
  try {
    const mat = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!mat.rows.length) return res.status(404).json({ message: 'Material not found' });
    await db.query(
      'UPDATE materials SET status=$1, approved_by=$2 WHERE id=$3',
      ['approved', req.user.id, req.params.id]
    );
    const { awardPoints } = require('../utils/pointsHelper');
    await awardPoints(mat.rows[0].uploader_id, 'MATERIAL_APPROVED', mat.rows[0].id, 'material');
    await db.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [mat.rows[0].uploader_id, `Your material "${mat.rows[0].title}" has been approved! +10 points awarded.`, 'success']
    );
    res.json({ message: 'Approved successfully' });
  } catch (err) {
    console.error('PATCH /materials/:id/approve error:', err);
    res.status(500).json({ message: 'Approval failed' });
  }
});

// PATCH /api/materials/:id/reject — faculty only
router.patch('/:id/reject', auth, role('faculty'), async (req, res) => {
  const { reason } = req.body;
  try {
    const mat = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!mat.rows.length) return res.status(404).json({ message: 'Material not found' });
    await db.query(
      'UPDATE materials SET status=$1, rejection_reason=$2 WHERE id=$3',
      ['rejected', reason || 'No reason provided', req.params.id]
    );
    await db.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [mat.rows[0].uploader_id, `Your material "${mat.rows[0].title}" was rejected. Reason: ${reason || 'No reason provided'}`, 'warning']
    );
    res.json({ message: 'Rejected' });
  } catch (err) {
    console.error('PATCH /materials/:id/reject error:', err);
    res.status(500).json({ message: 'Failed to reject material' });
  }
});

// PATCH /api/materials/:id/view — increment view count
router.patch('/:id/view', async (req, res) => {
  try {
    await db.query('UPDATE materials SET views = views + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

module.exports = router;
