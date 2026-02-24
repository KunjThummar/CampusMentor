// ===== CENTRALIZED API WRAPPER =====
const BASE_URL = 'https://campusmentor-9exv.onrender.com'; // Update after deploy

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('cm_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (multipart)
  if (options.body instanceof FormData) delete headers['Content-Type'];

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Error ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

const API = {
  get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiCall(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  patch: (endpoint, body) => apiCall(endpoint, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
};
