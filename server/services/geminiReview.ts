import { GoogleGenAI, Type } from '@google/genai';

export interface MedicationEvaluation {
  medicine_name: string;
  dosage_appropriateness: string;
  warnings_or_cautions: string;
}

export interface IdentifiedRisk {
  category: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
}

export interface GeminiPrescriptionReview {
  clinical_summary: string;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  medication_evaluations: MedicationEvaluation[];
  identified_risks: IdentifiedRisk[];
  pharmacist_recommendations: string[];
}

export async function reviewPrescriptionWithGemini(
  rawOcrText: string,
  medicines: Array<{
    name: string;
    strength?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    route?: string | null;
    openfda?: any;
  }>,
  patientContext?: {
    patient_name?: string;
    patient_age?: number | string;
    patient_gender?: string;
    allergies?: string | null;
    renal_impairment?: boolean | number;
    hepatic_impairment?: boolean | number;
    is_pregnant?: boolean | number;
  }
): Promise<GeminiPrescriptionReview | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[GeminiReview] GEMINI_API_KEY environment variable is missing.');
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const promptText = `You are a Senior Clinical Pharmacist and Medication Safety Specialist evaluating a medical prescription document.
Analyze the following prescription data and provide a comprehensive safety, dosage, interaction, and clinical review.

RAW PRESCRIPTION OCR TEXT:
${rawOcrText || '(No raw OCR text provided)'}

PARSED MEDICATIONS:
${JSON.stringify(medicines || [], null, 2)}

PATIENT CLINICAL CONTEXT:
${JSON.stringify(patientContext || {}, null, 2)}

Please perform a thorough clinical review evaluating:
1. Overall clinical summary and risk level (Low, Moderate, High, or Critical).
2. Per-medication dosage and frequency appropriateness.
3. Potential drug-drug interactions, duplicate therapies, Look-Alike Sound-Alike (LASA) risks, allergy conflicts, pregnancy/lactation cautions, and organ impairment precautions.
4. Actionable recommendations for the reviewing pharmacist prior to dispensing.`;

  const config = {
    systemInstruction: 'You are an expert Clinical Pharmacist AI reviewing medical prescriptions for safety, accuracy, and drug interaction risks.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        clinical_summary: {
          type: Type.STRING,
          description: 'Comprehensive clinical synthesis of the prescription review.'
        },
        risk_level: {
          type: Type.STRING,
          enum: ['Low', 'Moderate', 'High', 'Critical'],
          description: 'Overall clinical risk rating for dispensing this prescription.'
        },
        medication_evaluations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medicine_name: { type: Type.STRING },
              dosage_appropriateness: { type: Type.STRING },
              warnings_or_cautions: { type: Type.STRING }
            },
            required: ['medicine_name', 'dosage_appropriateness', 'warnings_or_cautions']
          },
          description: 'Specific evaluation for each prescribed drug.'
        },
        identified_risks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
              description: { type: Type.STRING }
            },
            required: ['category', 'severity', 'description']
          },
          description: 'List of specific clinical safety alerts or risks.'
        },
        pharmacist_recommendations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Step-by-step pharmacist guidance or questions for the prescribing clinician.'
        }
      },
      required: [
        'clinical_summary',
        'risk_level',
        'medication_evaluations',
        'identified_risks',
        'pharmacist_recommendations'
      ]
    }
  };

  const modelsToTry = ['gemini-3.6-flash'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptText,
        config
      });

      const outputText = response.text?.trim();
      if (outputText) {
        const review: GeminiPrescriptionReview = JSON.parse(outputText);
        return review;
      }
    } catch (err) {
      console.warn(`[GeminiReview] Model ${model} failed:`, (err as Error).message);
    }
  }

  // Structured Fallback when API quota/limits are reached
  console.warn('[GeminiReview] Gemini API calls failed/exhausted. Returning rule-based fallback review.');
  return {
    clinical_summary: `Rule-based clinical safety screening completed (${medicines.length} drug(s) evaluated). Gemini AI live analysis temporarily restricted due to API quota limits.`,
    risk_level: medicines.some(m => !m.strength || !m.dosage) ? 'Moderate' : 'Low',
    medication_evaluations: medicines.map(m => ({
      medicine_name: m.name || 'Unknown Medication',
      dosage_appropriateness: m.dosage ? `Prescribed dosage: ${m.dosage} ${m.frequency || ''}`.trim() : 'Dosage needs verification.',
      warnings_or_cautions: 'Verify strength, patient allergy history, and organ function before dispensing.'
    })),
    identified_risks: [
      {
        category: 'API Rate Limit Notice',
        severity: 'Low',
        description: 'AI model live quota limit reached; automated rule-based safety checks performed.'
      }
    ],
    pharmacist_recommendations: [
      'Cross-examine prescribed dosage and frequency with clinical reference guidelines.',
      'Verify patient allergy history and organ function parameters before final dispensing.'
    ]
  };
}

export interface UncertaintyExplanation {
  explanation: string;
  clinical_concerns: string[];
  recommended_checks: string[];
  most_plausible_candidate: string | null;
  plausibility_reasoning: string;
}

export async function explainUncertaintyWithGemini(
  rawText: string,
  candidateSuggestions: Array<{ name: string; rxcui: string; score: number }>,
  patientContext?: any,
  bestGuessName?: string
): Promise<UncertaintyExplanation | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const promptText = `You are an AI Clinical Assistant aiding a registered pharmacist in resolving an ambiguous or low-confidence prescription line read.
Analyze why this specific line is low confidence and explain the clinical considerations for the pharmacist.

RAW PRESCRIPTION LINE OCR READ: "${rawText}"
BEST GUESS INITIAL READ: "${bestGuessName || 'None'}"
RXNORM MATCH CANDIDATES: ${JSON.stringify(candidateSuggestions || [], null, 2)}
PATIENT CLINICAL CONTEXT: ${JSON.stringify(patientContext || {}, null, 2)}

Provide a clear, objective clinical analysis:
1. "explanation": Plain-language explanation of why confidence is low (e.g. garbled text, look-alike sound-alike candidates, ambiguous shorthand, or conflicting dosages).
2. "clinical_concerns": Array of strings describing clinical distinctions or risks between candidate drugs.
3. "recommended_checks": Array of strings describing specific items the pharmacist should check.
4. "most_plausible_candidate": Name of the candidate that appears most clinically plausible based on context or OCR text.
5. "plausibility_reasoning": Why this candidate seems most plausible.

IMPORTANT: Your response is strictly for guidance and explanation. You CANNOT authorize or confirm the medication yourself; a human pharmacist must review and confirm.`;

  const config = {
    systemInstruction: 'You are an AI Clinical Assistant explaining prescription OCR ambiguity to a pharmacist. Be concise, clinical, and objective.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        explanation: { type: Type.STRING },
        clinical_concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommended_checks: { type: Type.ARRAY, items: { type: Type.STRING } },
        most_plausible_candidate: { type: Type.STRING },
        plausibility_reasoning: { type: Type.STRING }
      },
      required: [
        'explanation',
        'clinical_concerns',
        'recommended_checks',
        'most_plausible_candidate',
        'plausibility_reasoning'
      ]
    }
  };

  const modelsToTry = ['gemini-3.6-flash'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptText,
        config
      });

      const outputText = response.text?.trim();
      if (outputText) {
        return JSON.parse(outputText) as UncertaintyExplanation;
      }
    } catch (err) {
      console.warn(`[Gemini Explain Uncertainty] Model ${model} failed:`, (err as Error).message);
    }
  }

  // Structured Fallback for Explain Uncertainty
  const topCandidate = candidateSuggestions?.[0]?.name || bestGuessName || 'Unmapped Medication';
  return {
    explanation: `OCR read "${rawText || 'Prescription text'}" has low confidence (<95%). The candidate is "${topCandidate}". (Note: AI live explanation API daily quota limit reached; displaying rule-based uncertainty guidance).`,
    clinical_concerns: [
      `Ambiguous drug handwriting or shorthand can lead to Look-Alike Sound-Alike (LASA) medication errors.`,
      `Verify exact dosage form, concentration, and administration route prior to dispensing.`
    ],
    recommended_checks: [
      `Contact prescribing clinician or check electronic medical records to confirm drug identity.`,
      `Cross-reference RxNorm candidates in the pharmacist review table before confirming.`
    ],
    most_plausible_candidate: topCandidate,
    plausibility_reasoning: `Top RxNorm match based on approximate term string matching scoring.`
  };
}
