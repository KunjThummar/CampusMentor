// ===== AUTH MANAGEMENT =====
const TOKEN_KEY = 'cm_token';
const USER_KEY = 'cm_user';

function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }

function getUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function logout() {
  clearAuth();
  window.location.href = '/login.html';
}

// Parse JWT payload
function parseJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

// Auth Guard - call on each dashboard page
function requireAuth(allowedRole) {
  const token = getToken();
  if (!token) { window.location.href = '/login.html'; return null; }
  const payload = parseJWT(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    clearAuth(); window.location.href = '/login.html'; return null;
  }
  if (allowedRole && payload.role !== allowedRole) {
    const routes = { junior: '/dashboard/junior.html', senior: '/dashboard/senior.html', faculty: '/dashboard/faculty.html' };
    window.location.href = routes[payload.role] || '/login.html';
    return null;
  }
  return payload;
}

// Fill sidebar user info
function fillUserInfo() {
  const user = getUser();
  if (!user) return;
  document.querySelectorAll('.sidebar-user-name').forEach(el => el.textContent = user.name);
  document.querySelectorAll('.sidebar-user-role').forEach(el => el.textContent = user.role);
  document.querySelectorAll('.sidebar-user-avatar').forEach(el => el.textContent = user.name?.charAt(0)?.toUpperCase());
  document.querySelectorAll('.user-avatar-text').forEach(el => el.textContent = user.name?.charAt(0)?.toUpperCase());
}
