# 🎓 CampusMentor – Peer-to-Peer Academic Platform

A full-stack web application connecting junior students, senior mentors, and faculty for academic collaboration.

## 🏗️ Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript (deployed on Vercel/Netlify)
- **Backend:** Node.js + Express (deployed on Render.com)
- **Database:** PostgreSQL (hosted on Neon.tech)

---

## 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

### STEP 1 — Setup Database on Neon.tech (5 minutes)
1. Go to **https://neon.tech** → Sign up (free)
2. Create a new project → Name it `campusmentor`
3. Click **SQL Editor**
4. Copy the entire contents of `database.sql` → Paste → Run
5. Copy your **Connection String** (looks like: `postgresql://user:pass@ep-xxx.neon.tech/dbname`)

---

### STEP 2 — Deploy Backend on Render.com (10 minutes)
1. Push the `server/` folder to a **GitHub repository**
2. Go to **https://render.com** → Sign up → **New Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
5. Add **Environment Variables** (click "Environment" tab):
   ```
   DATABASE_URL = (paste from Neon.tech)
   JWT_SECRET = (generate a random 32+ char string)
   NODE_ENV = production
   PORT = 5000
   CLIENT_URL = https://your-app.vercel.app  ← update after step 3
   GMAIL_USER = your.email@gmail.com
   GMAIL_PASS = your_16_char_app_password
   ```
6. Deploy → Wait ~3 minutes
7. Copy your Render URL: `https://campusmentor-api.onrender.com`

---

### STEP 3 — Deploy Frontend on Vercel (5 minutes)
1. Push the `client/` folder to a GitHub repo (can be same repo)
2. Open `client/js/api.js` — update line 2:
   ```javascript
   const BASE_URL = 'https://campusmentor-api.onrender.com';
   ```
3. Go to **https://vercel.com** → New Project → Import repo
4. Settings:
   - **Root Directory:** `client`
   - No build command needed (static files)
5. Deploy → Get your URL: `https://campusmentor-xyz.vercel.app`

---

### STEP 4 — Connect Frontend ↔ Backend (2 minutes)
1. Go back to **Render.com** → Your service → Environment
2. Update `CLIENT_URL` to your Vercel URL
3. Redeploy

---

### STEP 5 — Gmail App Password (for password reset emails)
1. Go to your Google Account → **Security**
2. Enable **2-Step Verification**
3. Search "App passwords" → Create one → Copy the 16-char password
4. Paste it as `GMAIL_PASS` in Render environment

---

### STEP 6 — Test Everything
1. Register as **Faculty** first → then Senior → then Junior
2. As Senior: Upload a material → check it appears in My Uploads immediately
3. As Faculty: Go to Approvals → approve it → check +10 points for senior
4. As Junior: Ask a doubt → see it appear in My Doubts
5. As Senior: Go to Solve Doubts → answer it → check +5 points

---

## 👥 User Roles

| Role | Can Do |
|------|--------|
| **Junior** | Browse materials & projects, ask doubts, view answers |
| **Senior** | Everything junior can + upload materials/projects, solve doubts, earn points & certificates |
| **Faculty** | Everything + approve/reject uploads, manage users, view full analytics |

## 💰 Points System
- Material approved by faculty: **+10 points**
- Project approved by faculty: **+15 points**
- Doubt answered: **+5 points**
- Reach 100 points → **PDF Certificate unlocked automatically**

## ⏱️ Doubt Escalation
Doubts unanswered for **48 hours** are automatically escalated to faculty (runs every hour via cron job).

---

## 📁 Project Structure
```
campusmentor/
├── client/          ← Frontend (deploy to Vercel)
│   ├── index.html   ← Landing page
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── dashboard/
│   │   ├── junior.html
│   │   ├── senior.html
│   │   └── faculty.html
│   ├── css/
│   └── js/
├── server/          ← Backend (deploy to Render)
│   ├── index.js
│   ├── db.js
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   ├── cron/
│   └── utils/
├── database.sql     ← Run this on Neon.tech
└── README.md
```
