import { SafetyAlert } from './safety';

export interface RxScoreResult {
  score: number;
  band: 'Safe' | 'Needs Review' | 'High Risk';
  deductions: Array<{ reason: string; points: number }>;
}

export function calculateRxScore(
  medicines: Array<{ name: string; strength?: string | null; frequency?: string | null; confidence?: number; rxcui?: string | null }>,
  alerts: SafetyAlert[],
  ocrConfidence: number = 1.0
): RxScoreResult {
  let score = 100;
  const deductions: Array<{ reason: string; points: number }> = [];

  if (!medicines || medicines.length === 0) {
    return {
      score: 0,
      band: 'High Risk',
      deductions: [{ reason: 'No valid medicines present in prescription analysis', points: 100 }]
    };
  }

  // 1. Deduct for high/medium/low safety alerts
  alerts.forEach(alert => {
    let penalty = 0;
    if (alert.severity === 'high') {
      penalty = alert.type === 'allergy' ? 25 : alert.type === 'interaction' ? 20 : 15;
    } else if (alert.severity === 'medium') {
      penalty = 10;
    } else {
      penalty = 5;
    }

    score -= penalty;
    deductions.push({ reason: alert.title, points: penalty });
  });

  // 2. Deduct for incomplete medicine details (missing strength or frequency)
  medicines.forEach(med => {
    if (!med.strength) {
      score -= 5;
      deductions.push({ reason: `Missing strength for ${med.name}`, points: 5 });
    }
    if (!med.frequency) {
      score -= 5;
      deductions.push({ reason: `Missing dosage frequency for ${med.name}`, points: 5 });
    }
    if (!med.rxcui) {
      score -= 10;
      deductions.push({ reason: `Unverified / Unmapped RxCUI for ${med.name}`, points: 10 });
    }
  });

  // 3. Deduct for illegibility penalty from OCR confidence
  if (ocrConfidence < 0.90) {
    const illegibilityPenalty = Math.round((0.90 - ocrConfidence) * 30);
    if (illegibilityPenalty > 0) {
      score -= illegibilityPenalty;
      deductions.push({ reason: `Illegibility Penalty (Average OCR confidence ${Math.round(ocrConfidence * 100)}%)`, points: illegibilityPenalty });
    }
  }

  // Ensure bounds 0 <= score <= 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine band
  let band: 'Safe' | 'Needs Review' | 'High Risk' = 'Safe';
  if (score < 50) {
    band = 'High Risk';
  } else if (score < 80) {
    band = 'Needs Review';
  }

  return {
    score,
    band,
    deductions
  };
}
