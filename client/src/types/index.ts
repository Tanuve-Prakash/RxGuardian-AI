export interface User {
  id: number;
  email: string;
  clinic_name?: string;
}

export interface OpenFDALabel {
  drug_interactions: string | null;
  warnings: string | null;
  dosage_and_administration: string | null;
  contraindications: string | null;
  pregnancy_or_breastfeeding: string | null;
  found: boolean;
}

export interface RxNormCandidateSuggestion {
  name: string;
  rxcui: string;
  score: number;
}

export type VerificationStatus = 'not_required' | 'pending' | 'in_progress' | 'confirmed';
export type VerificationMethod = 'doctor_contact' | 'pharmacist_network' | 'ai_assistant' | null;
export type EscalationRole = 'senior_pharmacist' | 'hospital_pharmacist' | 'specialist' | 'doctor' | null;

export interface MedicineCandidate {
  id: string;
  original_line: string;
  name: string;
  rxcui: string | null;
  strength: string | null;     // Real string or null (Guardrail 1!)
  dosage: string | null;       // Real string or null
  frequency: string | null;    // Real string or null
  duration: string | null;     // Real string or null
  route: string | null;        // Real string or null
  confidence: number;
  needs_review: boolean;
  is_confirmed?: boolean;
  alternatives: string[];
  raw_text?: string;
  best_guess_name?: string;
  alt_guess_1?: string | null;
  alt_guess_2?: string | null;
  rxnorm_suggestions?: RxNormCandidateSuggestion[];
  openfda?: OpenFDALabel;

  // Verification Gate & Consensus Fields
  consensus_agreement?: boolean;
  consensus_reasoning?: string | null;
  verification_status?: VerificationStatus;
  verification_method?: VerificationMethod;
  escalation_role?: EscalationRole;
  verified_by?: string | null;
  verification_notes?: string | null;
  verified_at?: string | null;

  // Dispensing State
  is_dispensed?: boolean;
  dispensed_at?: string | null;
  dispensed_by?: string | null;
}

export interface SafetyAlert {
  id: string;
  type: 'interaction' | 'duplicate' | 'lasa' | 'allergy' | 'contraindication' | 'high_risk' | 'dosage_warning';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_medicines: string[];
}

export interface RxScore {
  score: number;
  band: 'Safe' | 'Needs Review' | 'High Risk';
  deductions: Array<{ reason: string; points: number }>;
}

export interface PatientContext {
  patient_name?: string;
  patient_age?: number | string;
  patient_gender?: string;
  allergies?: string;
  renal_impairment?: boolean;
  hepatic_impairment?: boolean;
  is_pregnant?: boolean;
  patient_id?: string;
  current_medications?: CurrentMedication[];
  previous_reactions?: string;
}

export interface CurrentMedication {
  name: string;
  rxcui?: string | null;
  started_at?: string | null;
}

export interface PatientPassport {
  id: string;
  user_id: number;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  allergies?: string | null;
  current_medications: CurrentMedication[];
  past_prescriptions_ref: string[];
  previous_reactions?: string | null;
  is_pregnant: boolean;
  renal_impairment: boolean;
  hepatic_impairment: boolean;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  qr_token: string;
  qr_code_data_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GeminiPrescriptionReview {
  clinical_summary: string;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  medication_evaluations: Array<{
    medicine_name: string;
    dosage_appropriateness: string;
    warnings_or_cautions: string;
  }>;
  identified_risks: Array<{
    category: string;
    severity: 'High' | 'Medium' | 'Low';
    description: string;
  }>;
  pharmacist_recommendations: string[];
}

export interface AnalysisRecord {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  allergies: string | null;
  renal_impairment: number;
  hepatic_impairment: number;
  is_pregnant: number;
  raw_ocr_text: string;
  rxscore: number;
  band: 'Safe' | 'Needs Review' | 'High Risk';
  medicines: MedicineCandidate[];
  alerts: SafetyAlert[];
  created_at: string;
  gemini_review?: GeminiPrescriptionReview | null;
}

export interface DashboardStats {
  total_analyzed: number;
  alerts_flagged: number;
  average_rxscore: number;
  most_common_alert: string;
}
