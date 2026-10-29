import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request and handle FormData
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('meiora_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('meiora_token');
      localStorage.removeItem('meiora_user');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;

/* ── Auth ───────────────────────────────────────────────── */
export const authService = {
  register:    (data) => api.post('/auth/register', data),
  verifyOtp:   (data) => api.post('/auth/verify-otp', data),
  resendOtp:   (data) => api.post('/auth/resend-otp', data),
  login:       (data) => api.post('/auth/login', data),
  googleLogin: (data) => api.post('/auth/google', data),
  getMe:       ()     => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

/* ── Analysis ───────────────────────────────────────────── */
export const analysisService = {
  analyzeNews:          (data)    => api.post('/analysis/news', data),
  analyzeBrand:         (data)    => api.post('/analysis/brand', data),
  analyzeRumor:         (data)    => api.post('/analysis/rumor', data),
  analyzeDeepfakeVideo: (data)    => api.post('/analysis/deepfake-video', data),
  getHistory:           (params)  => api.get('/analysis/history', { params }),
  getById:              (id)      => api.get(`/analysis/${id}`),
  deleteById:           (id)      => api.delete(`/analysis/${id}`),
};

/* ── Reports ────────────────────────────────────────────── */
export const reportsService = {
  getAll:    (params) => api.get('/reports', { params }),
  download:  (id)     => api.get(`/reports/${id}/download`, { responseType: 'blob' }),
};

/* ── Copilot ─────────────────────────────────────────────── */
export const copilotService = {
  ask: (data) => api.post('/copilot/ask', data),
};

/* ── Discover ────────────────────────────────────────────── */
export const discoverService = {
  getTrending: (params) => api.get('/discover/trending', { params }),
};
