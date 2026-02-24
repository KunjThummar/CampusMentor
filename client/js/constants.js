// ===== SHARED CONSTANTS =====
const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'Electronics & Telecommunication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering'
];

const SUBJECTS = [
  'Data Structures',
  'DBMS',
  'Operating Systems',
  'Computer Networks',
  'Software Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Machine Learning',
  'Web Technology',
  'Theory of Computation',
  'Compiler Design'
];

const YEARS = [1, 2, 3, 4];

// Populate a <select> element with options
function populateDropdown(selectId, options, placeholder = 'Select...') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

// Populate all department dropdowns on page
function populateAllDepartments() {
  document.querySelectorAll('.dept-select').forEach(sel => {
    const id = sel.id;
    const current = sel.value;
    sel.innerHTML = `<option value="">All Departments</option>`;
    DEPARTMENTS.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d;
      if (d === current) o.selected = true;
      sel.appendChild(o);
    });
  });
}

function populateAllSubjects() {
  document.querySelectorAll('.subj-select').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = `<option value="">All Subjects</option>`;
    SUBJECTS.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      if (s === current) o.selected = true;
      sel.appendChild(o);
    });
  });
}

// Format date
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Relative time
function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// Badge HTML
function getBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

// Hours remaining countdown
function hoursRemaining(createdAt) {
  const deadline = new Date(new Date(createdAt).getTime() + 48 * 3600000);
  const remaining = Math.max(0, Math.floor((deadline - new Date()) / 3600000));
  return remaining;
}
