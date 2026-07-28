import axios from 'axios';

// Shared Axios instance with credentials enabled for HTTP-only cookies
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Request interceptor to attach Bearer token if stored in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rxguardian_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for clear error formatting and handling 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rxguardian_token');
    }
    const message = error.response?.data?.error || error.message || 'An unexpected server error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
