require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// // ===== CORS =====
// app.use(cors({
//   origin: true,
//   credentials: true
// }));

const cors = require('cors');

app.use(cors({
  origin: process.env.campus-mentor-alpha.vercel.app,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure all upload subdirectories exist at startup
['uploads/materials', 'uploads/projects', 'uploads/certificates'].forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

// ===== ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/doubts', require('./routes/doubts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Start cron job
require('./cron/escalationJob');

// ===== GLOBAL ERROR HANDLER =====
// This ensures ALL unhandled errors return JSON (never HTML)
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error'
  });
});

// 404 handler — also return JSON not HTML
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.url}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CampusMentor server running on port ${PORT}`));
