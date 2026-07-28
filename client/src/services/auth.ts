import api from './api';
import { User } from '../types';

export async function loginApi(email: string, password: string): Promise<{ user: User; token: string }> {
  const response = await api.post('/auth/login', { email, password });
  if (response.data?.token) {
    localStorage.setItem('rxguardian_token', response.data.token);
  }
  return response.data;
}

export async function signupApi(email: string, password: string, clinic_name?: string): Promise<{ user: User; token: string }> {
  const response = await api.post('/auth/signup', { email, password, clinic_name });
  if (response.data?.token) {
    localStorage.setItem('rxguardian_token', response.data.token);
  }
  return response.data;
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.removeItem('rxguardian_token');
  }
}

export async function getMeApi(): Promise<{ user: User }> {
  const response = await api.get('/auth/me');
  return response.data;
}
