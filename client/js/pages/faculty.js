// ===== FACULTY DASHBOARD LOGIC =====
let rejectTarget = null; let approvalsTab = 'materials';

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth('faculty');
  if (!user) return;
  fillUserInfo();
  initSidebar();
  initNavigation();
  populateAllDepartments();
  populateAllSubjects();
  document.getElementById('welcomeName').textContent = getUser()?.name?.split(' ')[0] || 'Professor';

  loadStats();

  document.addEventListener('sectionChanged', ({ detail: { section } }) => {
    if (section === 'approvals') loadApprovals();
    if (section === 'all-materials') loadAllMaterials();
    if (section === 'all-projects') loadAllProjects();
    if (section === 'users') loadUsers();
    if (section === 'analytics') loadAnalytics();
  });

  ['allMatSearch','allMatSubject','allMatDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadAllMaterials, 400));
    document.getElementById(id)?.addEventListener('change', loadAllMaterials);
  });
  ['allProjSearch','allProjDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadAllProjects, 400));
    document.getElementById(id)?.addEventListener('change', loadAllProjects);
  });
  ['userSearch','userRoleFilter','userDeptFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(loadUsers, 400));
    document.getElementById(id)?.addEventListener('change', loadUsers);
  });

  document.getElementById('rejectModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('rejectModal')) closeRejectModal();
  });
});

async function loadStats() {
  try {
    const data = await API.get('/api/analytics/faculty-stats');
    document.getElementById('statPending').textContent = data.pending || 0;
    document.getElementById('statActiveUsers').textContent = data.activeUsers || 0;
    document.getElementById('statMaterials').textContent = data.materials || 0;
    document.getElementById('statProjects').textContent = data.projects || 0;
    document.getElementById('statEscalated').textContent = data.escalated || 0;
    document.getElementById('statSeniors').textContent = data.seniors || 0;
    const pending = (data.pendingMaterials || 0) + (data.pendingProjects || 0);
    const badge = document.getElementById('pendingCount');
    if (pending > 0) { badge.textContent = pending; badge.style.display = ''; }
  } catch (err) { console.error(err); }
}

async function loadApprovals() {
  const container = document.getElementById('approvalsContent');
  container.innerHTML = '<div class="skeleton" style="height:100px;border-radius:12px;margin-bottom:12px"></div>'.repeat(3);
  try {
    if (approvalsTab === 'materials') {
      const data = await API.get('/api/materials?status=pending&limit=50');
      container.innerHTML = data.materials?.length
        ? data.materials.map(m => approvalCard(m, 'material')).join('')
        : emptyState('No pending materials', 'All caught up! 🎉');
    } else {
      const data = await API.get('/api/projects?status=pending&limit=50');
      container.innerHTML = data.projects?.length
        ? data.projects.map(p => approvalCard(p, 'project')).join('')
        : emptyState('No pending projects', 'All caught up! 🎉');
    }
  } catch { container.innerHTML = emptyState('Failed to load'); }
}

async function loadAllMaterials() {
  const search = document.getElementById('allMatSearch')?.value || '';
  const subject = document.getElementById('allMatSubject')?.value || '';
  const dept = document.getElementById('allMatDept')?.value || '';
  const grid = document.getElementById('allMaterialsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:150px;border-radius:12px"></div>'.repeat(6);
  try {
    const params = new URLSearchParams({ limit: 50 });
    if (search) params.set('search', search);
    if (subject) params.set('subject', subject);
    if (dept) params.set('department', dept);
    const data = await API.get('/api/materials?' + params);
    grid.innerHTML = data.materials?.length ? data.materials.map(m => materialBrowseCard(m)).join('') : emptyState('No materials found');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadAllProjects() {
  const search = document.getElementById('allProjSearch')?.value || '';
  const dept = document.getElementById('allProjDept')?.value || '';
  const grid = document.getElementById('allProjectsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:150px;border-radius:12px"></div>'.repeat(6);
  try {
    const params = new URLSearchParams({ limit: 50 });
    if (search) params.set('search', search);
    if (dept) params.set('department', dept);
    const data = await API.get('/api/projects?' + params);
    grid.innerHTML = data.projects?.length ? data.projects.map(p => projectBrowseCard(p)).join('') : emptyState('No projects found');
  } catch { grid.innerHTML = emptyState('Failed to load'); }
}

async function loadUsers() {
  const search = document.getElementById('userSearch')?.value || '';
  const role = document.getElementById('userRoleFilter')?.value || '';
  const dept = document.getElementById('userDeptFilter')?.value || '';
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Loading...</td></tr>';
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (dept) params.set('department', dept);
    const data = await API.get('/api/users?' + params);
    if (!data.users?.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No users found</td></tr>'; return; }
    tbody.innerHTML = data.users.map(u => `<tr>
      <td><strong>${escHtml(u.name)}</strong></td>
      <td style="color:var(--text-secondary)">${escHtml(u.email)}</td>
      <td><span class="badge badge-${u.role}">${u.role}</span></td>
      <td>${escHtml(u.department||'–')}</td>
      <td><strong style="color:var(--accent)">${u.points||0}</strong></td>
      <td><label class="toggle-switch">
        <input type="checkbox" class="toggle-input" ${u.is_active?'checked':''} onchange="toggleUser(${u.id}, this.checked)"/>
        <span class="toggle-slider"></span>
      </label></td>
      <td style="color:var(--text-muted)">${formatDate(u.created_at)}</td>
    </tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger)">Failed to load</td></tr>'; }
}

async function loadAnalytics() {
  try {
    const data = await API.get('/api/analytics/faculty-full');
    // Top Mentors
    const mentorsEl = document.getElementById('topMentors');
    mentorsEl.innerHTML = data.topMentors?.length
      ? data.topMentors.map((u, i) => `<div class="flex justify-between items-center" style="padding:8px 0;border-bottom:1px solid var(--border-color)">
          <div class="flex items-center gap-8"><span style="width:24px;height:24px;background:var(--accent-light);color:var(--accent);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i+1}</span><span>${escHtml(u.name)}</span></div>
          <strong style="color:var(--accent)">${u.points} pts</strong>
        </div>`).join('')
      : '<p style="color:var(--text-muted)">No data yet</p>';

    // Top Materials
    const matsEl = document.getElementById('topMaterials');
    matsEl.innerHTML = data.topMaterials?.length
      ? data.topMaterials.map(m => `<div class="flex justify-between" style="padding:8px 0;border-bottom:1px solid var(--border-color)">
          <span class="truncate">${escHtml(m.title)}</span><span style="color:var(--text-muted)">👁 ${m.views}</span>
        </div>`).join('')
      : '<p style="color:var(--text-muted)">No data yet</p>';

    // Chart
    if (data.deptEngagement?.length) {
      const ctx = document.getElementById('deptChart').getContext('2d');
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.deptEngagement.map(d => d.department),
          datasets: [{
            label: 'Materials + Projects',
            data: data.deptEngagement.map(d => d.count),
            backgroundColor: 'rgba(201, 100, 66, 0.7)',
            borderColor: '#c96442', borderWidth: 1, borderRadius: 6
          }]
        },
        options: {
          responsive: true, plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: isDark ? '#a0a0a0' : '#6b6b6b' }, grid: { color: isDark ? '#3d3d3d' : '#e5e5e5' } },
            x: { ticks: { color: isDark ? '#a0a0a0' : '#6b6b6b' }, grid: { display: false } }
          }
        }
      });
    }

    // Escalated Doubts
    const escEl = document.getElementById('escalatedList');
    escEl.innerHTML = data.escalatedDoubts?.length
      ? data.escalatedDoubts.map(d => `<div class="doubt-card">
          <div class="doubt-header"><div class="doubt-question">${escHtml(d.question)}</div><span class="badge badge-escalated">Escalated</span></div>
          <div class="doubt-meta"><span>${escHtml(d.subject||'')}</span> · <span>Asked by: ${escHtml(d.asker_name||'')}</span> · <span>${timeAgo(d.escalated_at)}</span></div>
        </div>`).join('')
      : '<p style="color:var(--text-muted)">No escalated doubts. Great!</p>';
  } catch (err) { console.error(err); }
}

async function approveItem(id, type) {
  try {
    const endpoint = type === 'material' ? `/api/materials/${id}/approve` : `/api/projects/${id}/approve`;
    await API.patch(endpoint);
    showToast(`${type === 'material' ? 'Material' : 'Project'} approved! Points awarded to uploader.`, 'success');
    loadApprovals(); loadStats();
  } catch (err) { showToast(err.message || 'Failed to approve', 'error'); }
}

function openRejectModal(id, type) {
  rejectTarget = { id, type };
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').classList.add('active');
}
function closeRejectModal() { document.getElementById('rejectModal').classList.remove('active'); rejectTarget = null; }
async function confirmReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('Please provide a rejection reason', 'warning'); return; }
  try {
    const { id, type } = rejectTarget;
    const endpoint = type === 'material' ? `/api/materials/${id}/reject` : `/api/projects/${id}/reject`;
    await API.patch(endpoint, { reason });
    showToast('Submission rejected. Student has been notified.', 'info');
    closeRejectModal(); loadApprovals(); loadStats();
  } catch (err) { showToast(err.message || 'Failed to reject', 'error'); }
}

async function toggleUser(id, active) {
  try {
    await API.patch(`/api/users/${id}/toggle-active`, { is_active: active });
    showToast(`User ${active ? 'activated' : 'deactivated'} successfully`, 'success');
    loadStats();
  } catch (err) { showToast(err.message || 'Failed to update', 'error'); loadUsers(); }
}

function switchApprovalsTab(tab) {
  approvalsTab = tab;
  document.querySelectorAll('#section-approvals .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadApprovals();
}

function approvalCard(item, type) {
  return `<div class="approval-card">
    <div class="approval-info">
      <div class="approval-title">${escHtml(item.title)}</div>
      <div class="approval-meta">
        By: <strong>${escHtml(item.uploader_name||'Unknown')}</strong> ·
        ${escHtml(item.department||'')} ·
        ${type === 'material' ? escHtml(item.subject||'') + ' · ' : ''}
        ${timeAgo(item.created_at)}
      </div>
      ${item.description || item.abstract ? `<p style="font-size:13px;color:var(--text-secondary);margin-top:6px">${escHtml((item.description || item.abstract || '').slice(0, 150))}...</p>` : ''}
      ${item.file_url ? `<a href="${BASE_URL}${item.file_url}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:8px;padding-left:0">Preview File ↗</a>` : ''}
      ${item.github_link ? `<a href="${escHtml(item.github_link)}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:8px">GitHub ↗</a>` : ''}
    </div>
    <div class="approval-actions">
      <button class="btn btn-success btn-sm" onclick="approveItem(${item.id}, '${type}')">Approve</button>
      <button class="btn btn-danger btn-sm" onclick="openRejectModal(${item.id}, '${type}')">Reject</button>
    </div>
  </div>`;
}

function materialBrowseCard(m) {
  return `<div class="material-card"><div>
    <div class="material-title">${escHtml(m.title)}</div>
    <div class="material-meta" style="margin-top:8px"><span class="badge badge-${m.status}">${m.status}</span><span class="badge" style="background:var(--bg-hover);color:var(--text-secondary)">${escHtml(m.subject||'')}</span></div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:6px">By: ${escHtml(m.uploader_name||'')}</div>
  </div></div>`;
}

function projectBrowseCard(p) {
  return `<div class="project-card"><div class="project-title">${escHtml(p.title)}</div>
    <div class="material-meta" style="margin-top:8px"><span class="badge badge-${p.status}">${p.status}</span></div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:6px">By: ${escHtml(p.uploader_name||'')}</div>
  </div>`;
}

function emptyState(title, msg='') { return `<div class="empty-state"><h3>${title}</h3><p>${msg}</p></div>`; }
function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
