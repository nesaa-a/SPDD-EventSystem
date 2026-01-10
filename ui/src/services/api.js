import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// JWT decode utility
export const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please check if the backend server is running.';
    } else if (error.message === 'Network Error' || !error.response) {
      error.message = 'Network Error: Cannot connect to backend server. Make sure the backend is running on ' + API_BASE_URL;
    } else if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Events API
export const eventsAPI = {
  getAll: async () => {
    const response = await api.get('/events');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  
  create: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },
  
  update: async (id, eventData) => {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },
  
  search: async (query, category) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    const response = await api.get(`/events/search?${params.toString()}`);
    return response.data;
  },
  
  getCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },
  
  getComments: async (eventId) => {
    const response = await api.get(`/events/${eventId}/comments`);
    return response.data;
  },
  
  addComment: async (eventId, commentData) => {
    const response = await api.post(`/events/${eventId}/comments`, commentData);
    return response.data;
  },
};

// Participants API
export const participantsAPI = {
  getByEventId: async (eventId) => {
    const response = await api.get(`/events/${eventId}/participants`);
    return response.data;
  },
  
  register: async (eventId, participantData) => {
    const response = await api.post(`/events/${eventId}/participants`, participantData);
    return response.data;
  },
  
  remove: async (eventId, participantId) => {
    const response = await api.delete(`/events/${eventId}/participants/${participantId}`);
    return response.data;
  },
  
  checkin: async (eventId, participantId) => {
    const response = await api.post(`/events/${eventId}/participants/${participantId}/checkin`);
    return response.data;
  },
  
  exportCSV: async (eventId) => {
    const response = await api.get(`/events/${eventId}/participants/export`, {
      responseType: 'blob'
    });
    return response.data;
  },
};

// Waitlist API
export const waitlistAPI = {
  getByEventId: async (eventId) => {
    const response = await api.get(`/events/${eventId}/waitlist`);
    return response.data;
  },
  
  join: async (eventId, data) => {
    const response = await api.post(`/events/${eventId}/waitlist`, data);
    return response.data;
  },
  
  remove: async (eventId, waitlistId) => {
    const response = await api.delete(`/events/${eventId}/waitlist/${waitlistId}`);
    return response.data;
  },
};

// My Events API
export const myEventsAPI = {
  getMyEvents: async () => {
    const response = await api.get('/my-events');
    return response.data;
  },
};

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/register', userData);
    return response.data;
  },
  
  login: async (credentials) => {
    const response = await api.post('/login', credentials);
    return response.data;
  },
};

// Reporting API
export const reportingAPI = {
  getStats: async () => {
    const response = await api.get('/reporting');
    return response.data;
  },
};

// Search API (Elasticsearch)
export const searchAPI = {
  search: async (query, options = {}) => {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.category) params.append('category', options.category);
    if (options.from_date) params.append('from_date', options.from_date);
    if (options.to_date) params.append('to_date', options.to_date);
    params.append('page', options.page || 1);
    params.append('size', options.size || 10);
    
    const response = await api.get(`/api/search/events?${params.toString()}`);
    return response.data;
  },
  
  indexEvent: async (eventId) => {
    const response = await api.post(`/api/search/index-event/${eventId}`);
    return response.data;
  },
  
  reindexAll: async () => {
    const response = await api.post('/api/search/reindex-all');
    return response.data;
  },
};

// Cache API (Redis)
export const cacheAPI = {
  getStats: async () => {
    const response = await api.get('/api/cache/stats');
    return response.data;
  },
  
  clear: async (pattern = '*') => {
    const response = await api.delete(`/api/cache/clear?pattern=${pattern}`);
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getSummary: async () => {
    const response = await api.get('/api/analytics/summary');
    return response.data;
  },
  
  getClustering: async () => {
    const response = await api.get('/api/analytics/clustering');
    return response.data;
  },
  
  getAnomalies: async () => {
    const response = await api.get('/api/analytics/anomalies');
    return response.data;
  },
};

// Audit Log API
export const auditAPI = {
  getLogs: async (options = {}) => {
    const params = new URLSearchParams();
    if (options.entity_type) params.append('entity_type', options.entity_type);
    if (options.action) params.append('action', options.action);
    params.append('page', options.page || 1);
    params.append('size', options.size || 50);
    
    const response = await api.get(`/api/audit/logs?${params.toString()}`);
    return response.data;
  },
  
  verifyChain: async () => {
    const response = await api.get('/api/audit/verify');
    return response.data;
  },
};

// Data Quality API
export const dataQualityAPI = {
  validateEvent: async (eventData) => {
    const response = await api.post('/api/data-quality/validate-event', eventData);
    return response.data;
  },
  
  getReport: async () => {
    const response = await api.get('/api/data-quality/report');
    return response.data;
  },
};

// System Status API
export const systemAPI = {
  getStatus: async () => {
    const response = await api.get('/api/system/status');
    return response.data;
  },
};
