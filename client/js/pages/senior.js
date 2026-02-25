// ===== SENIOR DASHBOARD LOGIC =====
let user, currentPointsTab = 'materials';

document.addEventListener('DOMContentLoaded', async () => {
  user = requireAuth('senior');
  if (!user) return;
  fillUserInfo();
  initSidebar();
  initNavigation();
  populateAllDepartments();
  populateAllSubjects();

  document.getElementById('welcomeName').textContent = getUser()?.name?.split(' ')[0] || 'Senior';

  loadStats();
  loadNotifications();

  document.addEventListener('sectionChanged', ({ detail: { section } }) => {
    if (section === 'materials') loadMaterials();
    if (section === 'projects') loadProjects();
    if (section === 'solve-doubts') loadAssignedDoubts();
    if (section === 'my-uploads') { loadMyMaterials(); loadMyProjects(); }
    if (section === 'my-points') loadMyPoints();
    if (section === 'certificate') loadCertificate();
  });

  ['materialSearch','materialSubject','materialDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadMaterials, 400));
    document.getElementById(id)?.addEventListener('change', loadMaterials);
  });
  ['projectSearch','projectDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadProjects, 400));
    document.getElementById(id)?.addEventListener('change', loadProjects);
  });

  document.getElementById('materialForm')?.addEventListener('submit', uploadMaterial);
  document.getElementById('projectForm')?.addEventListener('submit', uploadProject);

  document.getElementById('notifBtn')?.addEventListener('click', () => {
    document.getElementById('notifDropdown').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) {
      document.getElementById('notifDropdown')?.classList.remove('open');
    }
  });

  const userDept = getUser()?.department;
  if (userDept) setTimeout(() => {
    ['matDept','projDept'].forEach(id => { const el = document.getElementById(id); if (el) el.value = userDept; });
  }, 200);
});

async function loadStats() {
  try {
    const data = await API.get('/analytics/senior-stats');
    document.getElementById('statPoints').textContent = data.points || 0;
    document.getElementById('statApproved').textContent = data.approved || 0;
    document.getElementById('statPending').textContent = data.pending || 0;
    document.getElementById('statSolved').textContent = data.solved || 0;

    const pts = Math.min(data.points || 0, 100);
    document.getElementById('pointsBar').style.width = pts + '%';
    document.getElementById('pointsPercent').textContent = `${data.points || 0} / 100`;
    document.getElementById('pointsMsg').textContent = data.points >= 100
      ? '🎉 You\'ve reached 100 points! Download your certificate.'
      : `${100 - (data.points || 0)} more points to unlock your certificate!`;

    const badge = document.getElementById('pendingDoubtsCount');
    if (data.assignedDoubts > 0) { badge.textContent = data.assignedDoubts; badge.style.display = ''; }
  } catch (err) { console.error(err); }
}

async function loadMaterials() {
  const search = document.getElementById('materialSearch')?.value || '';
  const subject = document.getElementById('materialSubject')?.value || '';
  const dept = document.getElementById('materialDept')?.value || '';
  const grid = document.getElementById('materialsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:150px;border-radius:12px"></div>'.repeat(6);
  try {
    const params = new URLSearchParams({ status: 'approved', limit: 30 });
    if (search) params.set('search', search);
    if (subject) params.set('subject', subject);
    if (dept) params.set('department', dept);
    const data = await API.get('/materials?' + params);
    grid.innerHTML = data.materials?.length ? data.materials.map(m => materialCard(m)).join('') : emptyState('No materials found');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadProjects() {
  const search = document.getElementById('projectSearch')?.value || '';
  const dept = document.getElementById('projectDept')?.value || '';
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>'.repeat(6);
  try {
    const params = new URLSearchParams({ status: 'approved', limit: 30 });
    if (search) params.set('search', search);
    if (dept) params.set('department', dept);
    const data = await API.get('/projects?' + params);
    grid.innerHTML = data.projects?.length ? data.projects.map(p => projectCard(p)).join('') : emptyState('No projects found');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadAssignedDoubts() {
  const container = document.getElementById('assignedDoubtsContainer');
  container.innerHTML = '<div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:12px"></div>'.repeat(3);
  try {
    const data = await API.get('/doubts/assigned');
    if (!data.doubts?.length) { container.innerHTML = emptyState('No doubts assigned', 'Great work! Check back later.'); return; }
    container.innerHTML = data.doubts.map(d => assignedDoubtCard(d)).join('');
  } catch { container.innerHTML = emptyState('Failed to load doubts'); }
}

async function loadMyMaterials() {
  const grid = document.getElementById('myMaterialsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:150px;border-radius:12px"></div>'.repeat(3);
  try {
    const data = await API.get('/materials/my');
    grid.innerHTML = data.materials?.length ? data.materials.map(m => myMaterialCard(m)).join('') : emptyState('No uploads yet', 'Upload your first material!');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadMyProjects() {
  const grid = document.getElementById('myProjectsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:150px;border-radius:12px"></div>'.repeat(3);
  try {
    const data = await API.get('/projects/my');
    grid.innerHTML = data.projects?.length ? data.projects.map(p => myProjectCard(p)).join('') : emptyState('No projects yet', 'Upload your first project!');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadMyPoints() {
  try {
    const data = await API.get('/users/points');
    document.getElementById('pointsTotal').textContent = data.points || 0;
    const pct = Math.min((data.points || 0), 100);
    document.getElementById('pointsBarFull').style.width = pct + '%';
    const tbody = document.getElementById('pointsLogBody');
    if (!data.log?.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No activity yet</td></tr>'; return; }
    tbody.innerHTML = data.log.map(l => `<tr>
      <td>${escHtml(l.action)}</td>
      <td><span style="color:var(--success);font-weight:700">+${l.points_earned}</span></td>
      <td>${formatDate(l.created_at)}</td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
}

async function loadCertificate() {
  const container = document.getElementById('certificateContainer');
  try {
    const data = await API.get('/certificates/my');
    if (data.certificate) {
      const u = getUser();
      container.innerHTML = `
        <div class="card" style="max-width:500px;text-align:center;padding:40px">
          <div style="width:64px;height:64px;background:var(--accent-light);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:var(--accent)">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
          <h2 style="font-size:22px;font-weight:800;margin-bottom:8px">🎉 Certificate Unlocked!</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">Congratulations! You've earned <strong>${data.certificate.total_points} points</strong> by mentoring juniors.</p>
          <a href="${BASE_URL}/certificates/download/${data.certificate.id}" class="btn btn-primary btn-lg" target="_blank">Download PDF Certificate</a>
          <p style="font-size:12px;color:var(--text-muted);margin-top:12px">Issued on ${formatDate(data.certificate.issued_at)}</p>
        </div>`;
    } else {
      const statsData = await API.get('/analytics/senior-stats');
      const pts = statsData.points || 0;
      container.innerHTML = `
        <div class="card" style="max-width:500px;text-align:center;padding:40px">
          <div style="width:64px;height:64px;background:var(--bg-hover);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:var(--text-muted)">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Keep Contributing!</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px">You need <strong>${100 - pts} more points</strong> to earn your certificate.</p>
          <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" style="width:${pts}%"></div></div>
          <p style="font-size:13px;color:var(--text-muted)">${pts} / 100 points</p>
        </div>`;
    }
  } catch (err) { console.error(err); }
}

async function uploadMaterial(e) {
  e.preventDefault();
  const btn = document.getElementById('matBtn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    const fd = new FormData();
    fd.append('title', document.getElementById('matTitle').value);
    fd.append('subject', document.getElementById('matSubject').value);
    fd.append('department', document.getElementById('matDept').value);
    fd.append('year', document.getElementById('matYear').value);
    fd.append('description', document.getElementById('matDesc').value);
    fd.append('file', document.getElementById('matFile').files[0]);
    const data = await API.post('/materials', fd);
    showToast('Material uploaded! Awaiting faculty approval.', 'success');
    document.getElementById('materialForm').reset();
    // Immediately add to My Uploads list
    const grid = document.getElementById('myMaterialsGrid');
    if (grid.querySelector('.empty-state')) grid.innerHTML = '';
    grid.insertAdjacentHTML('afterbegin', myMaterialCard(data.material));
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Upload Material'; }
}

async function uploadProject(e) {
  e.preventDefault();
  const btn = document.getElementById('projBtn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    const fd = new FormData();
    fd.append('title', document.getElementById('projTitle').value);
    fd.append('abstract', document.getElementById('projAbstract').value);
    fd.append('tech_stack', document.getElementById('projTech').value);
    fd.append('github_link', document.getElementById('projGithub').value);
    fd.append('demo_video_link', document.getElementById('projDemo').value);
    fd.append('department', document.getElementById('projDept').value);
    if (document.getElementById('projPPT').files[0]) fd.append('ppt', document.getElementById('projPPT').files[0]);
    if (document.getElementById('projReport').files[0]) fd.append('report', document.getElementById('projReport').files[0]);

    const members = [];
    document.querySelectorAll('input[name="memberName[]"]').forEach((el, i) => {
      const role = document.querySelectorAll('input[name="memberRole[]"]')[i]?.value;
      if (el.value) members.push({ name: el.value, role: role || '' });
    });
    fd.append('team_members', JSON.stringify(members));

    const data = await API.post('/projects', fd);
    showToast('Project uploaded! Awaiting faculty approval.', 'success');
    document.getElementById('projectForm').reset();
  } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Upload Project'; }
}

async function submitAnswer(doubtId) {
  const textarea = document.getElementById('answer-' + doubtId);
  const answer = textarea?.value?.trim();
  if (!answer || answer.length < 10) { showToast('Please write a proper answer (min 10 chars)', 'warning'); return; }
  try {
    await API.patch('/doubts/' + doubtId + '/answer', { answer });
    showToast('+5 points earned! Answer submitted.', 'success');
    loadAssignedDoubts();
    loadStats();
  } catch (err) { showToast(err.message || 'Failed to submit', 'error'); }
}

async function loadNotifications() {
  try {
    const data = await API.get('/users/notifications');
    const unread = data.notifications?.filter(n => !n.is_read).length || 0;
    const countEl = document.getElementById('notifCount');
    if (unread > 0) { countEl.textContent = unread; countEl.style.display = ''; }
    const list = document.getElementById('notifList');
    if (!data.notifications?.length) return;
    list.innerHTML = data.notifications.slice(0,8).map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markRead(${n.id})">
        <div class="notif-text">${escHtml(n.message)}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>`).join('');
  } catch {}
}

async function markRead(id) { try { await API.patch('/users/notifications/' + id + '/read'); loadNotifications(); } catch {} }
async function markAllRead() { try { await API.patch('/users/notifications/read-all'); loadNotifications(); showToast('All marked as read', 'success'); } catch {} }

function addTeamMember() {
  const div = document.createElement('div');
  div.className = 'grid-2';
  div.style.marginBottom = '8px';
  div.innerHTML = `<input class="form-input" type="text" placeholder="Member name" name="memberName[]"/><input class="form-input" type="text" placeholder="Role" name="memberRole[]"/>`;
  document.getElementById('teamMembers').appendChild(div);
}

function switchTab(prefix, tabId) {
  document.querySelectorAll(`#section-${prefix === 'uploads' ? 'my-uploads' : prefix} .tab-btn`).forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll(`[id^="${prefix}-"]`).forEach(c => c.classList.remove('active'));
  document.getElementById(prefix + '-' + tabId.split('-').pop() + '-tab') && document.getElementById(prefix + '-' + tabId).classList.add('active');
}

function materialCard(m) {
  return `<div class="material-card"><div><div class="material-title">${escHtml(m.title)}</div>
    <div class="material-meta" style="margin-top:8px"><span class="badge badge-approved">${escHtml(m.subject||'')}</span></div></div>
    <div class="flex justify-between items-center" style="margin-top:12px">
      <span class="material-info">👁 ${m.views||0} views</span>
      ${m.file_url ? `<a href="${BASE_URL}${m.file_url}" target="_blank" class="btn btn-primary btn-sm">Download</a>` : ''}
    </div></div>`;
}

function myMaterialCard(m) {
  return `<div class="material-card"><div><div class="material-title">${escHtml(m.title)}</div>
    <div class="material-meta" style="margin-top:8px"><span class="badge badge-${m.status}">${m.status}</span><span class="badge" style="background:var(--bg-hover);color:var(--text-secondary)">${escHtml(m.subject||'')}</span></div></div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${formatDate(m.created_at)}</div>
    ${m.status==='rejected'&&m.rejection_reason?`<div style="margin-top:8px;padding:8px;background:var(--danger-bg);border-radius:6px;font-size:12px;color:var(--danger)">Rejected: ${escHtml(m.rejection_reason)}</div>`:''}
  </div>`;
}

function myProjectCard(p) {
  return `<div class="project-card"><div class="project-title">${escHtml(p.title)}</div>
    <div class="material-meta" style="margin-top:8px"><span class="badge badge-${p.status}">${p.status}</span></div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${formatDate(p.created_at)}</div>
    ${p.status==='rejected'&&p.rejection_reason?`<div style="margin-top:8px;padding:8px;background:var(--danger-bg);border-radius:6px;font-size:12px;color:var(--danger)">Rejected: ${escHtml(p.rejection_reason)}</div>`:''}
  </div>`;
}

function projectCard(p) {
  const tags = (p.tech_stack||'').split(',').filter(Boolean).slice(0,4);
  return `<div class="project-card"><div class="project-title">${escHtml(p.title)}</div>
    <div class="project-abstract">${escHtml(p.abstract||'')}</div>
    <div class="project-tech">${tags.map(t=>`<span class="tech-tag">${escHtml(t.trim())}</span>`).join('')}</div>
    <div class="project-footer"><span class="material-info">👁 ${p.views||0}</span>
      <div class="flex gap-8">
        ${p.github_link?`<a href="${escHtml(p.github_link)}" target="_blank" class="btn btn-secondary btn-sm">GitHub</a>`:''}
        ${p.demo_video_link?`<a href="${escHtml(p.demo_video_link)}" target="_blank" class="btn btn-primary btn-sm">Demo</a>`:''}
      </div></div></div>`;
}

function assignedDoubtCard(d) {
  const hrs = hoursRemaining(d.created_at);
  return `<div class="doubt-card">
    <div class="doubt-header"><div class="doubt-question">${escHtml(d.question)}</div>${getBadge(d.status)}</div>
    <div class="doubt-meta">
      <span>${escHtml(d.subject||'')}</span> · <span>${escHtml(d.department||'')}</span> · 
      <span>Asked by: <strong>${escHtml(d.asker_name||'Student')}</strong></span> ·
      <span class="countdown">⏱ ${hrs}h remaining before escalation</span>
    </div>
    ${d.status === 'open' ? `
    <div style="margin-top:12px">
      <textarea class="form-textarea" id="answer-${d.id}" placeholder="Write your answer here..." rows="3"></textarea>
      <button class="btn btn-success btn-sm" style="margin-top:8px" onclick="submitAnswer(${d.id})">Submit Answer (+5 pts)</button>
    </div>` : `<div class="doubt-answer"><div class="doubt-answer-label">Your Answer</div><div class="doubt-answer-text">${escHtml(d.answer||'')}</div></div>`}
  </div>`;
}

function emptyState(title, msg='') {
  return `<div class="empty-state" style="grid-column:1/-1"><h3>${title}</h3><p>${msg}</p></div>`;
}
function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
