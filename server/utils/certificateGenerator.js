const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function generateCertificate(userId) {
  const userRes = await db.query('SELECT name, department, points FROM users WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user) return;

  const filename = `certificate_${userId}_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, '../uploads/certificates', filename);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  // Background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7f7f5');
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke('#c96442');
  doc.rect(35, 35, doc.page.width - 70, doc.page.height - 70).stroke('#c96442');

  // Header
  doc.fillColor('#c96442').fontSize(36).font('Helvetica-Bold').text('CampusMentor', 0, 80, { align: 'center' });
  doc.fillColor('#6b6b6b').fontSize(14).font('Helvetica').text('Certificate of Achievement', 0, 125, { align: 'center' });

  // Line
  doc.moveTo(100, 155).lineTo(doc.page.width - 100, 155).stroke('#c96442');

  // Body
  doc.fillColor('#1a1a1a').fontSize(16).font('Helvetica').text('This is to certify that', 0, 180, { align: 'center' });
  doc.fillColor('#c96442').fontSize(32).font('Helvetica-Bold').text(user.name, 0, 210, { align: 'center' });
  doc.fillColor('#1a1a1a').fontSize(14).font('Helvetica')
    .text(`from the Department of ${user.department}`, 0, 255, { align: 'center' })
    .text(`has earned ${user.points} points through outstanding contributions to`, 0, 280, { align: 'center' })
    .text('peer mentoring, sharing study materials, and resolving academic doubts', 0, 300, { align: 'center' })
    .text('on the CampusMentor platform.', 0, 320, { align: 'center' });

  // Line
  doc.moveTo(100, 355).lineTo(doc.page.width - 100, 355).stroke('#c96442');

  // Footer
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.fillColor('#6b6b6b').fontSize(12).text(`Date of Issue: ${date}`, 0, 370, { align: 'center' });
  doc.fillColor('#c96442').fontSize(10).text('CampusMentor – Learn Together, Grow Together', 0, 395, { align: 'center' });

  doc.end();

  await new Promise(resolve => stream.on('finish', resolve));

  const certUrl = `/uploads/certificates/${filename}`;
  await db.query(
    'INSERT INTO certificates (user_id, total_points, certificate_url) VALUES ($1, $2, $3)',
    [userId, user.points, certUrl]
  );
  return certUrl;
}

module.exports = { generateCertificate };
