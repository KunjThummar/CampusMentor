const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

async function sendResetEmail(toEmail, resetLink) {
  await transporter.sendMail({
    from: `"CampusMentor" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset Your CampusMentor Password',
    html: `<div style="font-family:sans-serif;max-width:480px;padding:32px">
      <h2 style="color:#c96442">CampusMentor</h2>
      <p>Click below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="display:inline-block;background:#c96442;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
      <p style="color:#9b9b9b;font-size:13px">If you did not request this, ignore this email.</p>
    </div>`
  });
}

module.exports = { sendResetEmail };
