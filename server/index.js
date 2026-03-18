require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ FIX 1: Use correct env variable name (CLIENT_URL)
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ STATIC FILES
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Ensure directories exist
['uploads/materials', 'uploads/projects', 'uploads/certificates'].forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});


// ================= ROOT ROUTE (ADD THIS) =================
app.get("/", (req, res) => {
  res.send("🚀 CampusMentor API is running successfully!");
});


// ================= ROUTES =================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/doubts', require('./routes/doubts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/analytics', require('./routes/analytics'));


// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);


// ================= CRON =================
require('./cron/escalationJob');


// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});


// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.url}` });
});


// ================= SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
