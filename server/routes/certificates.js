const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// GET /api/certificates/my
router.get('/my', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1', [req.user.id]);
    res.json({ certificate: result.rows[0] || null });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

// GET /api/certificates/download/:id
router.get('/download/:id', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM certificates WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Certificate not found' });
    const cert = result.rows[0];
    const filePath = path.join(__dirname, '..', cert.certificate_url);
    res.download(filePath, `CampusMentor_Certificate_${req.user.name}.pdf`);
  } catch { res.status(500).json({ message: 'Download failed' }); }
});

module.exports = router;
