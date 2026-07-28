import { lookupRxNormApproximate, lookupRxNormCandidateSuggestions, RxNormMatch, RxNormCandidateSuggestion } from './rxnorm';
import { ExtractedMedicine } from './extractor';

export interface ParsedMedicineCandidate {
  id: string;
  original_line: string;
  name: string;
  rxcui: string | null;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  confidence: number;
  needs_review: boolean;
  is_confirmed: boolean;
  alternatives: string[];
  raw_text?: string;
  best_guess_name?: string;
  alt_guess_1?: string | null;
  alt_guess_2?: string | null;
  rxnorm_suggestions?: RxNormCandidateSuggestion[];
  consensus_agreement?: boolean;
  consensus_reasoning?: string | null;
  verification_status?: 'not_required' | 'pending' | 'in_progress' | 'confirmed';
  verification_method?: 'doctor_contact' | 'pharmacist_network' | 'ai_assistant' | null;
  escalation_role?: 'senior_pharmacist' | 'hospital_pharmacist' | 'specialist' | 'doctor' | null;
  verified_by?: string | null;
  verification_notes?: string | null;
  verified_at?: string | null;
}

// Regex extraction helpers for dosage components
const STRENGTH_REGEX = /\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|mEq|%|mg\/ml))\b/i;
const FREQUENCY_REGEX = /\b(once daily|twice daily|thrice daily|3 times a day|4 times a day|every \d+ hours|qd|bid|tid|qid|qhs|prn|as needed)\b/i;
const DURATION_REGEX = /\b(\d+\s*(?:days|weeks|months|day|week|month))\b/i;
const ROUTE_REGEX = /\b(oral|orally|po|topical|iv|im|subcutaneous|sublingual|intramuscular|intravenous)\b/i;
const DOSAGE_FORM_REGEX = /\b(\d+\s*(?:tab|tablet|tablets|cap|capsule|capsules|puff|puffs|drop|drops|ml|tsp))\b/i;

export async function parseExtractedMedicines(
  extractedMedicines: ExtractedMedicine[]
): Promise<ParsedMedicineCandidate[]> {
  const rawCandidates: ParsedMedicineCandidate[] = [];

  console.log(`[Parser EXECUTION] Evaluating ${extractedMedicines.length} Gemini-extracted medicine candidate(s)...`);

  for (let i = 0; i < extractedMedicines.length; i++) {
    const item = extractedMedicines[i];
    const rawText = item.raw_text || item.best_guess_name || '';
    const primaryNameCandidate = item.best_guess_name || rawText;

    if (!primaryNameCandidate || primaryNameCandidate.trim().length < 2) {
      console.log(`[Parser DISCARD] Candidate item ${i + 1} has no valid drug name.`);
      continue;
    }

    const geminiConf = item.confidence || 70;

    // Extract clinical dosage details
    const strengthMatch = rawText.match(STRENGTH_REGEX) || primaryNameCandidate.match(STRENGTH_REGEX);
    const freqMatch = rawText.match(FREQUENCY_REGEX);
    const durMatch = rawText.match(DURATION_REGEX);
    const routeMatch = rawText.match(ROUTE_REGEX);
    const formMatch = rawText.match(DOSAGE_FORM_REGEX);

    const strength = strengthMatch ? strengthMatch[1] : null;
    const frequency = item.frequency
      ? normalizeFrequency(item.frequency)
      : (freqMatch ? normalizeFrequency(freqMatch[1]) : null);
    const duration = item.duration || (durMatch ? durMatch[1] : null);
    const route = routeMatch ? normalizeRoute(routeMatch[1]) : null;
    const dosage = item.dosage || (formMatch ? formMatch[1] : null);

    // Check approximate RxNorm match with full term and cleaned drug name term
    const cleanBaseCandidate = primaryNameCandidate.replace(/\b\d+.*$/, '').trim();
    let rxNormMatch: RxNormMatch | null = await lookupRxNormApproximate(primaryNameCandidate);
    if ((!rxNormMatch || rxNormMatch.score < 70) && cleanBaseCandidate && cleanBaseCandidate !== primaryNameCandidate) {
      const baseMatch = await lookupRxNormApproximate(cleanBaseCandidate);
      if (baseMatch && baseMatch.score > (rxNormMatch?.score || 0)) {
        rxNormMatch = baseMatch;
      }
    }
    const rxScore = rxNormMatch ? rxNormMatch.score : 0;

    // Fetch RxNorm candidate suggestions for the candidate term
    const suggestions: RxNormCandidateSuggestion[] = await lookupRxNormCandidateSuggestions(cleanBaseCandidate || primaryNameCandidate);

    // Rank rxnorm_suggestions chips by combined score (RxNorm match score + whether Gemini's two passes agreed on that name)
    const rankedSuggestions: RxNormCandidateSuggestion[] = suggestions.map(sugg => {
      let agreementBonus = 0;
      if (item.consensus_agreement && item.best_guess_name) {
        const suggLower = sugg.name.toLowerCase();
        const guessLower = item.best_guess_name.toLowerCase();
        if (suggLower.includes(guessLower) || guessLower.includes(suggLower)) {
          agreementBonus = 15;
        }
      }
      return {
        ...sugg,
        score: Math.min(100, sugg.score + agreementBonus)
      };
    }).sort((a, b) => b.score - a.score);

    // CUTOFF DEFINITION FOR AUTO-RESOLUTION (95% CONFIDENCE THRESHOLD):
    // If Gemini confidence is >= 95% OR (Gemini >= 85% & RxNorm match >= 85%) and not flagged:
    // Auto-resolve with 95%+ confidence, confirming the medicine and bypassing the 3-option review gate.
    // Otherwise, cap confidence at <95% (e.g. 90-94%) so the 3 review options (Doctor, Peer Queue, AI Assistant) trigger in the review table.
    const isHighConfidence = (geminiConf >= 95 || (geminiConf >= 85 && rxNormMatch !== null && rxScore >= 85)) && !item.needs_review && (item.consensus_agreement !== false);

    if (isHighConfidence) {
      const computedScore = Math.max(geminiConf, rxScore);
      const finalConfidence = Math.max(95, Math.min(100, computedScore));
      const resolvedName = rxNormMatch?.name || item.best_guess_name || primaryNameCandidate;
      console.log(`[Parser AUTO-RESOLVE HIGH CONFIDENCE] Candidate ${i + 1}: "${resolvedName}" (RxCUI=${rxNormMatch?.rxcui || 'N/A'}, Score=${rxScore}%, GeminiConf=${geminiConf}%, FinalConf=${finalConfidence}%)`);
      rawCandidates.push({
        id: `med-${i}-${Date.now()}`,
        original_line: rawText,
        name: resolvedName,
        rxcui: rxNormMatch?.rxcui || null,
        strength,
        dosage,
        frequency,
        duration,
        route,
        confidence: finalConfidence,
        needs_review: false,
        is_confirmed: true,
        alternatives: rxNormMatch?.synonyms || [],
        raw_text: rawText,
        best_guess_name: item.best_guess_name,
        alt_guess_1: item.alt_guess_1,
        alt_guess_2: item.alt_guess_2,
        rxnorm_suggestions: rankedSuggestions,
        consensus_agreement: item.consensus_agreement,
        consensus_reasoning: item.consensus_reasoning,
        verification_status: 'not_required',
        verification_method: null,
        escalation_role: null,
        verified_by: null,
        verification_notes: null,
        verified_at: null
      });
    } else {
      // Low/Moderate confidence or Gemini needs_review / consensus disagreement:
      // Keep confidence < 95% so that the 3 verification options (Doctor, Peer Queue, AI Assistant) are shown in the review table.
      const unconfirmedConf = Math.min(94, Math.max(60, geminiConf));
      console.log(`[Parser UNRESOLVED LOW CONFIDENCE] Candidate ${i + 1}: GeminiConf=${geminiConf}%, RxScore=${rxScore}%, Agreement=${item.consensus_agreement}. Keeping conf=${unconfirmedConf}% (<95%) to trigger 3 review options.`);
      rawCandidates.push({
        id: `med-${i}-${Date.now()}`,
        original_line: rawText,
        name: primaryNameCandidate,
        rxcui: rxNormMatch?.rxcui || null,
        strength,
        dosage,
        frequency,
        duration,
        route,
        confidence: unconfirmedConf,
        needs_review: true,
        is_confirmed: false,
        alternatives: rxNormMatch?.synonyms || [],
        raw_text: rawText,
        best_guess_name: item.best_guess_name,
        alt_guess_1: item.alt_guess_1,
        alt_guess_2: item.alt_guess_2,
        rxnorm_suggestions: rankedSuggestions,
        consensus_agreement: item.consensus_agreement,
        consensus_reasoning: item.consensus_reasoning,
        verification_status: 'pending',
        verification_method: null,
        escalation_role: null,
        verified_by: null,
        verification_notes: null,
        verified_at: null
      });
    }
  }

  // Deduplicate candidates by RxCUI or normalized drug name
  const candidateResults: ParsedMedicineCandidate[] = [];
  for (const cand of rawCandidates) {
    const existingIndex = candidateResults.findIndex(c =>
      (cand.rxcui && c.rxcui === cand.rxcui) ||
      c.name.toLowerCase() === cand.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = candidateResults[existingIndex];
      if (cand.confidence > existing.confidence) {
        candidateResults[existingIndex] = cand;
      }
    } else {
      candidateResults.push(cand);
    }
  }

  return candidateResults;
}

// Fallback method for line arrays or raw text
export async function parsePrescriptionLines(
  lines: Array<{ text: string; confidence: number }>
): Promise<ParsedMedicineCandidate[]> {
  const mockExtracted: ExtractedMedicine[] = lines.map(l => ({
    raw_text: l.text,
    best_guess_name: l.text,
    confidence: Math.round(l.confidence * 100),
    needs_review: l.confidence < 0.6
  }));
  return parseExtractedMedicines(mockExtracted);
}

function normalizeFrequency(freq: string): string {
  const lower = freq.toLowerCase().trim();
  if (lower === 'qd' || lower === 'once daily') return 'Once daily';
  if (lower === 'bid' || lower === 'twice daily') return 'Twice daily';
  if (lower === 'tid' || lower === '3 times a day' || lower === 'thrice daily') return 'Three times daily';
  if (lower === 'qid' || lower === '4 times a day') return 'Four times daily';
  if (lower === 'prn' || lower === 'as needed') return 'As needed (PRN)';
  if (lower === 'qhs') return 'At bedtime';
  return freq;
}

function normalizeRoute(route: string): string {
  const lower = route.toLowerCase().trim();
  if (lower === 'po' || lower === 'orally') return 'Oral';
  if (lower === 'iv') return 'Intravenous';
  if (lower === 'im') return 'Intramuscular';
  return route.charAt(0).toUpperCase() + route.slice(1);
}
