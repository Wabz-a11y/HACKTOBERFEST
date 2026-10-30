import axios from 'axios';
import { User, Reminder, Prescription, Alert } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (data: any) => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

// Reminders API
export const remindersApi = {
  list: async (patientId?: string): Promise<Reminder[]> => {
    const res = await apiClient.get('/reminders', { params: { patient_id: patientId } });
    return res.data;
  },
  updateStatus: async (reminderId: string, status: string): Promise<Reminder> => {
    const res = await apiClient.patch(`/reminders/${reminderId}/status`, { status });
    return res.data;
  },
  snooze: async (reminderId: string, minutes: number = 15): Promise<Reminder> => {
    const res = await apiClient.post(`/reminders/${reminderId}/snooze?minutes=${minutes}`);
    return res.data;
  },
  getStats: async (patientId?: string) => {
    const res = await apiClient.get('/reminders/adherence-stats', { params: { patient_id: patientId } });
    return res.data;
  },
};

// Prescriptions API
export const prescriptionsApi = {
  list: async (): Promise<Prescription[]> => {
    const res = await apiClient.get('/prescriptions');
    return res.data;
  },
  create: async (data: any): Promise<Prescription> => {
    const res = await apiClient.post('/prescriptions', data);
    return res.data;
  },
  parseText: async (text: string) => {
    const res = await apiClient.post('/prescriptions/parse-text', { text });
    return res.data;
  },
};

// Alerts API
export const alertsApi = {
  list: async (): Promise<Alert[]> => {
    const res = await apiClient.get('/alerts');
    return res.data;
  },
  acknowledge: async (id: string): Promise<Alert> => {
    const res = await apiClient.patch(`/alerts/${id}/acknowledge`);
    return res.data;
  },
};

// Doctor & Caregiver API
export const clinicalApi = {
  getCaregiverPatients: async () => {
    const res = await apiClient.get('/caregivers/patients');
    return res.data;
  },
  getCaregiverFeed: async () => {
    const res = await apiClient.get('/caregivers/dashboard-feed');
    return res.data;
  },
  getDoctorPatients: async () => {
    const res = await apiClient.get('/doctors/patients');
    return res.data;
  },
  getPatientSummary: async (patientId: string) => {
    const res = await apiClient.get(`/doctors/patients/${patientId}/summary`);
    return res.data;
  },
  getNearbyHospitals: async (lat?: number, lng?: number) => {
    const res = await apiClient.get('/maps/hospitals', { params: { lat, lng } });
    return res.data;
  },
};

// AI Agent Chat API
export const agentApi = {
  chat: async (message: string, sessionId: string = 'default_session', imageData?: string, patientInfo?: any) => {
    const res = await apiClient.post('/chat', {
      message,
      session_id: sessionId,
      image_data: imageData,
      patient_info: patientInfo,
    });
    return res.data;
  },
};

