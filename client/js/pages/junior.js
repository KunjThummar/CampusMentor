// ===== JUNIOR DASHBOARD LOGIC =====
let user;

document.addEventListener('DOMContentLoaded', async () => {
  user = requireAuth('junior');
  if (!user) return;

  fillUserInfo();
  initSidebar();
  initNavigation();
  populateAllDepartments();
  populateAllSubjects();

  document.getElementById('welcomeName').textContent = getUser()?.name?.split(' ')[0] || 'Student';

  const userDept = getUser()?.department;
  if (userDept) {
    setTimeout(() => {
      const sel = document.getElementById('doubtDept');
      if (sel) sel.value = userDept;
    }, 200);
  }

  loadStats();
  loadRecentMaterials();
  loadRecentProjects();
  loadNotifications();

  document.addEventListener('sectionChanged', ({ detail: { section } }) => {
    if (section === 'materials') loadMaterials();
    if (section === 'projects') loadProjects();
    if (section === 'my-doubts') loadMyDoubts();
  });

  ['materialSearch','materialSubject','materialDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadMaterials, 400));
    document.getElementById(id)?.addEventListener('change', loadMaterials);
  });
  ['projectSearch','projectDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadProjects, 400));
    document.getElementById(id)?.addEventListener('change', loadProjects);
  });

  document.getElementById('doubtQuestion')?.addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length;
  });

  document.getElementById('doubtForm')?.addEventListener('submit', submitDoubt);

  document.getElementById('notifBtn')?.addEventListener('click', () => {
    document.getElementById('notifDropdown').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) {
      document.getElementById('notifDropdown')?.classList.remove('open');
    }
  });
});

async function loadStats() {
  try {
    const data = await API.get('/api/analytics/junior-stats');
    document.getElementById('statMaterials').textContent = data.materials || 0;
    document.getElementById('statProjects').textContent = data.projects || 0;
    document.getElementById('statOpenDoubts').textContent = data.openDoubts || 0;
    document.getElementById('statAnswered').textContent = data.answeredDoubts || 0;
    const count = data.openDoubts || 0;
    const badge = document.getElementById('openDoubtsCount');
    if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  } catch (err) { console.error('Stats error:', err); }
}

async function loadRecentMaterials() {
  try {
    const data = await API.get('/api/materials?status=approved&limit=3');
    const grid = document.getElementById('recentMaterials');
    if (!data.materials?.length) { grid.innerHTML = '<p style="color:var(--text-muted)">No materials yet.</p>'; return; }
    grid.innerHTML = data.materials.map(m => materialCard(m)).join('');
  } catch (err) { console.error(err); }
}

async function loadRecentProjects() {
  try {
    const data = await API.get('/api/projects?status=approved&limit=3');
    const grid = document.getElementById('recentProjects');
    if (!data.projects?.length) { grid.innerHTML = '<p style="color:var(--text-muted)">No projects yet.</p>'; return; }
    grid.innerHTML = data.projects.map(p => projectCard(p)).join('');
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
    const data = await API.get('/api/materials?' + params);
    if (!data.materials?.length) { grid.innerHTML = emptyState('No materials found', 'Try adjusting your search filters.'); return; }
    grid.innerHTML = data.materials.map(m => materialCard(m)).join('');
  } catch (err) { grid.innerHTML = emptyState('Failed to load materials'); }
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
    const data = await API.get('/api/projects?' + params);
    if (!data.projects?.length) { grid.innerHTML = emptyState('No projects found'); return; }
    grid.innerHTML = data.projects.map(p => projectCard(p)).join('');
  } catch (err) { grid.innerHTML = emptyState('Failed to load projects'); }
}

async function loadMyDoubts() {
  const container = document.getElementById('myDoubtsContainer');
  container.innerHTML = '<div class="skeleton" style="height:100px;border-radius:12px;margin-bottom:12px"></div>'.repeat(3);
  try {
    const data = await API.get('/api/doubts/my');
    if (!data.doubts?.length) { container.innerHTML = emptyState('No doubts yet', 'Ask your first doubt from the menu!'); return; }
    container.innerHTML = data.doubts.map(d => doubtCard(d)).join('');
  } catch (err) { container.innerHTML = emptyState('Failed to load doubts'); }
}

async function submitDoubt(e) {
  e.preventDefault();
  const question = document.getElementById('doubtQuestion').value.trim();
  if (question.length < 20) { showToast('Question must be at least 20 characters.', 'warning'); return; }
  const btn = document.getElementById('doubtBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    await API.post('/api/doubts', {
      subject: document.getElementById('doubtSubject').value,
      department: document.getElementById('doubtDept').value,
      question
    });
    showToast('Doubt submitted! A senior will answer soon.', 'success');
    document.getElementById('doubtForm').reset();
    document.getElementById('charCount').textContent = '0';
    loadStats();
  } catch (err) {
    showToast(err.message || 'Failed to submit doubt', 'error');
  } finally { btn.disabled = false; btn.textContent = 'Submit Doubt'; }
}

async function loadNotifications() {
  try {
    const data = await API.get('/api/users/notifications');
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

async function markRead(id) {
  try { await API.patch('/api/users/notifications/' + id + '/read'); loadNotifications(); } catch {}
}
async function markAllRead() {
  try { await API.patch('/api/users/notifications/read-all'); loadNotifications(); showToast('All marked as read', 'success'); } catch {}
}

function materialCard(m) {
  return `<div class="material-card">
    <div><div class="material-title">${escHtml(m.title)}</div>
    <div class="material-meta" style="margin-top:8px">
      <span class="badge badge-approved">${escHtml(m.subject || '')}</span>
      <span class="badge" style="background:var(--bg-hover);color:var(--text-secondary)">${escHtml(m.department || '')}</span>
    </div></div>
    <div class="flex justify-between items-center" style="margin-top:12px">
      <span class="material-info">👁 ${m.views || 0} views</span>
      ${m.file_url ? `<a href="${BASE_URL}${m.file_url}" target="_blank" class="btn btn-primary btn-sm">Download</a>` : ''}
    </div></div>`;
}

function projectCard(p) {
  const tags = (p.tech_stack || '').split(',').filter(Boolean).slice(0,4);
  return `<div class="project-card">
    <div class="project-title">${escHtml(p.title)}</div>
    <div class="project-abstract">${escHtml(p.abstract || '')}</div>
    <div class="project-tech">${tags.map(t => `<span class="tech-tag">${escHtml(t.trim())}</span>`).join('')}</div>
    <div class="project-footer">
      <span class="material-info">👁 ${p.views || 0}</span>
      <div class="flex gap-8">
        ${p.github_link ? `<a href="${escHtml(p.github_link)}" target="_blank" class="btn btn-secondary btn-sm">GitHub</a>` : ''}
        ${p.demo_video_link ? `<a href="${escHtml(p.demo_video_link)}" target="_blank" class="btn btn-primary btn-sm">Demo</a>` : ''}
      </div>
    </div></div>`;
}

function doubtCard(d) {
  return `<div class="doubt-card">
    <div class="doubt-header"><div class="doubt-question">${escHtml(d.question)}</div>${getBadge(d.status)}</div>
    <div class="doubt-meta"><span>${escHtml(d.subject || '')}</span> · <span>${escHtml(d.department || '')}</span> · <span>${timeAgo(d.created_at)}</span></div>
    ${d.status === 'answered' && d.answer ? `<div class="doubt-answer"><div class="doubt-answer-label">✓ Answer</div><div class="doubt-answer-text">${escHtml(d.answer)}</div></div>` : ''}
    ${d.status === 'escalated' ? `<div style="margin-top:8px;padding:10px;background:var(--danger-bg);border-radius:var(--radius-md);font-size:13px;color:var(--danger)">⚠ Escalated to faculty</div>` : ''}
  </div>`;
}

function emptyState(title, msg = '') {
  return `<div class="empty-state" style="grid-column:1/-1"><h3>${title}</h3><p>${msg}</p></div>`;
}
function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
