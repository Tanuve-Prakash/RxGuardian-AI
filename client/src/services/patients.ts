import api from './api';
import { PatientPassport, AnalysisRecord } from '../types';

export async function listPatientsApi(search?: string): Promise<{ patients: PatientPassport[] }> {
  const response = await api.get('/patients', {
    params: { search }
  });
  return response.data;
}

export async function getPatientByIdApi(id: string): Promise<{ patient: PatientPassport; past_analyses?: AnalysisRecord[] }> {
  const response = await api.get(`/patients/${id}`);
  return response.data;
}

export async function getPatientByTokenApi(qrToken: string): Promise<{ patient: PatientPassport }> {
  const response = await api.get(`/patients/by-token/${encodeURIComponent(qrToken.trim())}`);
  return response.data;
}

export async function createPatientApi(data: Partial<PatientPassport>): Promise<{ patient: PatientPassport; message: string }> {
  const response = await api.post('/patients', data);
  return response.data;
}

export async function updatePatientApi(id: string, data: Partial<PatientPassport>): Promise<{ patient: PatientPassport; message: string }> {
  const response = await api.put(`/patients/${id}`, data);
  return response.data;
}

export async function deletePatientApi(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/patients/${id}`);
  return response.data;
}

export async function linkAnalysisToPatientApi(patientId: string, analysisId: string): Promise<{ message: string }> {
  const response = await api.post(`/patients/${patientId}/link-analysis`, { analysis_id: analysisId });
  return response.data;
}
