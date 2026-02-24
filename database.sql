-- ===== CAMPUSMENTOR DATABASE SETUP =====
-- Run this in Neon.tech SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(20) CHECK (role IN ('junior','senior','faculty')),
  department VARCHAR(100),
  year INTEGER,
  profile_pic TEXT DEFAULT '/assets/default-avatar.png',
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  reset_token TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  uploader_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  subject VARCHAR(100),
  department VARCHAR(100),
  year INTEGER,
  file_url TEXT,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  uploader_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  abstract TEXT,
  tech_stack TEXT,
  github_link TEXT,
  demo_video_link TEXT,
  ppt_url TEXT,
  report_pdf_url TEXT,
  screenshots JSONB DEFAULT '[]',
  team_members JSONB DEFAULT '[]',
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doubts (
  id SERIAL PRIMARY KEY,
  asker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_senior_id INTEGER REFERENCES users(id),
  faculty_id INTEGER REFERENCES users(id),
  subject VARCHAR(100),
  department VARCHAR(100),
  question TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','answered','escalated')),
  answer TEXT,
  answered_by INTEGER REFERENCES users(id),
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(150),
  points_earned INTEGER,
  reference_id INTEGER,
  reference_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER,
  certificate_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  type VARCHAR(30) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_department ON materials(department);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_doubts_asker ON doubts(asker_id);
CREATE INDEX IF NOT EXISTS idx_doubts_senior ON doubts(assigned_senior_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_points_log_user ON points_log(user_id);

-- Done!
SELECT 'CampusMentor database setup complete!' AS status;
