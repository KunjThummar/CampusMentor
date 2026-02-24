require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// app.use(cors({
//   origin: "https://campus-mentor-alpha.vercel.app",
//   credentials: true
// }));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CampusMentor server running on port ${PORT}`));
