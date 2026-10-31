import axios from 'axios';
import { User, Reminder, Prescription, Alert } from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

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
  updateProfile: async (data: any): Promise<User> => {
    const res = await apiClient.patch('/auth/me', data);
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};

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

export const alertsApi = {
  list: async (): Promise<Alert[]> => {
    const res = await apiClient.get('/alerts');
    return res.data;
  },
  acknowledge: async (id: string): Promise<Alert> => {
    const res = await apiClient.patch(`/alerts/${id}/acknowledge`, {});
    return res.data;
  },
  markAllRead: async () => {
    const res = await apiClient.patch('/alerts/read-all', {});
    return res.data;
  },
  toggleStar: async (id: string): Promise<Alert> => {
    const res = await apiClient.patch(`/alerts/${id}/star`, {});
    return res.data;
  },
  remove: async (id: string) => {
    const res = await apiClient.delete(`/alerts/${id}`);
    return res.data;
  },
};

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
