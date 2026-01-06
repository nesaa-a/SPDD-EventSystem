import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Add request interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please check if the backend server is running.';
    } else if (error.message === 'Network Error' || !error.response) {
      error.message = 'Network Error: Cannot connect to backend server. Make sure the backend is running on ' + API_BASE_URL;
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
};

