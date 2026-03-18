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

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '-' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// Upload handler
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}

// ================= ROUTES =================

// GET all materials
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM materials ORDER BY created_at DESC'
    );
    res.json({ materials: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch materials' });
  }
});

// UPLOAD
router.post('/', auth, role('senior'), handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File required' });
    }

    const fileUrl = `/uploads/materials/${req.file.filename}`;

    const result = await db.query(
      `INSERT INTO materials (uploader_id, title, file_url, status)
       VALUES ($1,$2,$3,'pending') RETURNING *`,
      [req.user.id, req.body.title, fileUrl]
    );

    res.json({ material: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed' });
  }
});


// ✅ 🔥 DOWNLOAD ROUTE (IMPORTANT FIX)
router.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads/materials', req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.download(filePath);
});


module.exports = router;
