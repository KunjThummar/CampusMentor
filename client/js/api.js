// ===== CENTRALIZED API WRAPPER =====
// Automatically use local server in development, deployed server in production
const BASE_URL = 'https://campusmentor-9exv.onrender.com/api';

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('cm_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (multipart) — browser sets it with boundary
  if (options.body instanceof FormData) delete headers['Content-Type'];

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    const contentType = res.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error(`Non-JSON response from ${endpoint}:`, {
        status: res.status,
        contentType,
        body: text.slice(0, 300)
      });
      throw new Error(`Server error (${res.status}). Please try again.`);
    }

    if (!res.ok) {
      throw new Error(data.message || `Error ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Is the server running?');
    }
    console.error(`API Error on ${endpoint}:`, err);
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
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
  }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
};
