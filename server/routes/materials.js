const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // ✅ added
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// ================= UPLOAD SETUP =================
const uploadPath = path.join(__dirname, '../uploads/materials');

// ensure folder exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use PDF, DOC, or PPTX.'));
    }
  }
});

// ================= ROUTES =================

// GET all materials
router.get('/', async (req, res) => {
  const { status, subject, department, search, limit = 30, offset = 0 } = req.query;
  try {
    let q = `SELECT m.*, u.name as uploader_name 
             FROM materials m 
             LEFT JOIN users u ON u.id = m.uploader_id 
             WHERE 1=1`;

    const params = [];

    if (status) {
      params.push(status);
      q += ` AND m.status = $${params.length}`;
    }

    if (subject) {
      params.push(subject);
      q += ` AND m.subject = $${params.length}`;
    }

    if (department) {
      params.push(department);
      q += ` AND m.department = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (m.title ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
    }

    params.push(parseInt(limit));
    q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

    params.push(parseInt(offset));
    q += ` OFFSET $${params.length}`;

    const result = await db.query(q, params);
    res.json({ materials: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch materials' });
  }
});

// GET own materials
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM materials WHERE uploader_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ materials: result.rows });
  } catch {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// UPLOAD
router.post('/', auth, role('senior'), upload.single('file'), async (req, res) => {
  const { title, subject, department, year, description } = req.body;

  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    const fileUrl = req.file
      ? `/uploads/materials/${req.file.filename}`
      : null;

    const result = await db.query(
      `INSERT INTO materials 
      (uploader_id, title, subject, department, year, file_url, description, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, title, subject, department, year || null, fileUrl, description, 'pending']
    );

    res.status(201).json({ material: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// ✅ 🔥 DOWNLOAD ROUTE (MAIN FIX)
router.get('/download/:filename', (req, res) => {
  const filePath = path.join(uploadPath, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.download(filePath);
});

// ================= OTHER ROUTES =================

// approve
router.patch('/:id/approve', auth, role('faculty'), async (req, res) => {
  try {
    await db.query(
      'UPDATE materials SET status=$1 WHERE id=$2',
      ['approved', req.params.id]
    );
    res.json({ message: 'Approved successfully' });
  } catch {
    res.status(500).json({ message: 'Approval failed' });
  }
});

// reject
router.patch('/:id/reject', auth, role('faculty'), async (req, res) => {
  try {
    await db.query(
      'UPDATE materials SET status=$1 WHERE id=$2',
      ['rejected', req.params.id]
    );
    res.json({ message: 'Rejected' });
  } catch {
    res.status(500).json({ message: 'Failed' });
  }
});

// view count
router.patch('/:id/view', async (req, res) => {
  try {
    await db.query(
      'UPDATE materials SET views = views + 1 WHERE id = $1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

module.exports = router;
