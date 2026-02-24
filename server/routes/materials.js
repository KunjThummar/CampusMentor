const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/materials')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({
  storage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.ppt','.pptx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Invalid file type. Use PDF, DOC, or PPTX.'));
  }
});

// GET /api/materials — public with filters
router.get('/', async (req, res) => {
  const { status, subject, department, search, limit = 30, offset = 0 } = req.query;
  try {
    let q = `SELECT m.*, u.name as uploader_name FROM materials m LEFT JOIN users u ON u.id = m.uploader_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND m.status = $${params.length}`; }
    if (subject) { params.push(subject); q += ` AND m.subject = $${params.length}`; }
    if (department) { params.push(department); q += ` AND m.department = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (m.title ILIKE $${params.length} OR m.description ILIKE $${params.length})`; }
    params.push(parseInt(limit)); q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
    params.push(parseInt(offset)); q += ` OFFSET $${params.length}`;
    const result = await db.query(q, params);
    res.json({ materials: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to fetch materials' }); }
});

// GET /api/materials/my — own uploads
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM materials WHERE uploader_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json({ materials: result.rows });
  } catch (err) { res.status(500).json({ message: 'Failed to fetch' }); }
});

// POST /api/materials — upload (senior only)
router.post('/', auth, role('senior'), upload.single('file'), async (req, res) => {
  const { title, subject, department, year, description } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const fileUrl = req.file ? `/uploads/materials/${req.file.filename}` : null;
    const result = await db.query(
      'INSERT INTO materials (uploader_id, title, subject, department, year, file_url, description, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user.id, title, subject, department, year || null, fileUrl, description, 'pending']
    );
    // Notify faculty
    const faculty = await db.query(`SELECT id FROM users WHERE role='faculty' AND department=$1 AND is_active=true LIMIT 1`, [department]);
    if (faculty.rows[0]) {
      await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
        [faculty.rows[0].id, `New material "${title}" submitted by ${req.user.name} awaiting your approval.`, 'info']);
    }
    res.status(201).json({ material: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: err.message || 'Upload failed' }); }
});

// PATCH /api/materials/:id/approve — faculty
router.patch('/:id/approve', auth, role('faculty'), async (req, res) => {
  try {
    const mat = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!mat.rows.length) return res.status(404).json({ message: 'Not found' });
    await db.query('UPDATE materials SET status=$1, approved_by=$2 WHERE id=$3', ['approved', req.user.id, req.params.id]);
    const { awardPoints } = require('../utils/pointsHelper');
    await awardPoints(mat.rows[0].uploader_id, 'MATERIAL_APPROVED', mat.rows[0].id, 'material');
    await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [mat.rows[0].uploader_id, `Your material "${mat.rows[0].title}" has been approved! +10 points awarded.`, 'success']);
    res.json({ message: 'Approved successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Approval failed' }); }
});

// PATCH /api/materials/:id/reject — faculty
router.patch('/:id/reject', auth, role('faculty'), async (req, res) => {
  const { reason } = req.body;
  try {
    const mat = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!mat.rows.length) return res.status(404).json({ message: 'Not found' });
    await db.query('UPDATE materials SET status=$1, rejection_reason=$2 WHERE id=$3', ['rejected', reason, req.params.id]);
    await db.query('INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,$3)',
      [mat.rows[0].uploader_id, `Your material "${mat.rows[0].title}" was rejected. Reason: ${reason}`, 'warning']);
    res.json({ message: 'Rejected' });
  } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

// PATCH /api/materials/:id/view
router.patch('/:id/view', async (req, res) => {
  try {
    await db.query('UPDATE materials SET views = views + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

module.exports = router;
