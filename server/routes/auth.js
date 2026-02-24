const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role, department, year } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: 'All fields required' });
  if (!['junior','senior','faculty'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department, year) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, department, year, points',
      [name, email, hash, role, department, year || null]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Registration failed' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ message: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ message: 'Your account has been deactivated. Contact faculty.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, points: user.points } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Login failed' }); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.json({ message: 'If this email exists, a reset link was sent.' });
    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    await db.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [token, expiry, email]);
    const resetLink = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;
    try {
      const { sendResetEmail } = require('../config/mailer');
      await sendResetEmail(email, resetLink);
    } catch (mailErr) { console.error('Email error:', mailErr.message); }
    res.json({ message: 'Reset link sent.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to send reset email' }); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
  try {
    const result = await db.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()', [token]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Invalid or expired reset link' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hash, result.rows[0].id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ message: 'Reset failed' }); }
});

// POST /api/auth/change-password (protected)
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ message: 'Failed to change password' }); }
});

module.exports = router;
