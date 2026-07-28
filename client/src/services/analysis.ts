import api from './api';
import { MedicineCandidate, SafetyAlert, RxScore, PatientContext, AnalysisRecord, DashboardStats, GeminiPrescriptionReview } from '../types';

export interface ExtractedMedicineItem {
  raw_text: string;
  best_guess_name: string;
  alt_guess_1?: string | null;
  alt_guess_2?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  confidence: number;
  needs_review: boolean;
}

export interface OCRResult {
  raw_text: string;
  confidence: number;
  patient_name?: string | null;
  doctor_name?: string | null;
  diagnosis?: string | null;
  medicines?: ExtractedMedicineItem[];
  lines?: Array<{ text: string; confidence: number }>;
}

export async function extractPrescriptionApi(file: File): Promise<OCRResult> {
  const formData = new FormData();
  formData.append('prescription', file);

  // Guardrail 4: Uses shared `api` instance (withCredentials: true), NO manual Content-Type header
  const response = await api.post('/analyses/extract', formData);
  return response.data;
}

export async function parsePrescriptionApi(
  extractedMedicines?: ExtractedMedicineItem[],
  lines?: Array<{ text: string; confidence: number }>
): Promise<{ medicines: MedicineCandidate[] }> {
  const response = await api.post('/analyses/parse', {
    extracted_medicines: extractedMedicines,
    lines: Array.isArray(lines) ? lines : []
  });
  return response.data;
}

export async function verifyMedicinesApi(medicines: MedicineCandidate[]): Promise<{ medicines: MedicineCandidate[] }> {
  const response = await api.post('/analyses/verify', { medicines });
  return response.data;
}

export async function checkSafetyApi(
  medicines: MedicineCandidate[],
  patientContext?: PatientContext,
  ocrConfidence?: number,
  rawOcrText?: string
): Promise<{ alerts: SafetyAlert[]; rxscore: RxScore; assessment_summary?: any; gemini_review?: GeminiPrescriptionReview | null }> {
  const response = await api.post('/analyses/check-safety', {
    medicines,
    patientContext,
    ocrConfidence,
    raw_ocr_text: rawOcrText
  });
  return response.data;
}

export async function getGeminiReviewApi(
  rawOcrText: string,
  medicines: MedicineCandidate[],
  patientContext?: PatientContext
): Promise<{ gemini_review: GeminiPrescriptionReview | null }> {
  const response = await api.post('/analyses/gemini-review', {
    raw_ocr_text: rawOcrText,
    medicines,
    patientContext
  });
  return response.data;
}

export async function explainUncertaintyApi(
  rawText: string,
  candidateSuggestions: any[],
  patientContext?: PatientContext,
  bestGuessName?: string
): Promise<{
  explanation: {
    explanation: string;
    clinical_concerns: string[];
    recommended_checks: string[];
    most_plausible_candidate: string | null;
    plausibility_reasoning: string;
  } | null;
}> {
  const response = await api.post('/analyses/explain-uncertainty', {
    raw_text: rawText,
    rxnorm_suggestions: candidateSuggestions,
    patientContext,
    best_guess_name: bestGuessName
  });
  return response.data;
}

export async function saveAnalysisApi(data: any): Promise<{ id: string; message: string }> {
  const response = await api.post('/analyses/save', data);
  return response.data;
}

export async function getHistoryApi(search?: string, band?: string): Promise<{ analyses: AnalysisRecord[] }> {
  const response = await api.get('/history', {
    params: { search, band }
  });
  return response.data;
}

export async function getAnalysisDetailApi(id: string): Promise<{ analysis: AnalysisRecord }> {
  const response = await api.get(`/history/${id}`);
  return response.data;
}

export async function deleteAnalysisApi(id: string): Promise<void> {
  await api.delete(`/history/${id}`);
}

export async function getDashboardStatsApi(): Promise<DashboardStats> {
  const response = await api.get('/dashboard/stats/summary');
  return response.data;
}
