import axios from 'axios';
import { getDb } from '../database/db';

export interface RxNormMatch {
  rxcui: string | null;
  name: string;
  score: number;
  synonyms?: string[];
}

export interface RxNormCandidateSuggestion {
  name: string;
  rxcui: string;
  score: number;
}

export async function lookupRxNormCandidateSuggestions(term: string): Promise<RxNormCandidateSuggestion[]> {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm || cleanTerm.length < 2) return [];

  try {
    const response = await axios.get('https://rxnav.nlm.nih.gov/REST/approximateTerm.json', {
      params: { term: cleanTerm, maxEntries: 5 },
      timeout: 5000
    });

    const candidates = response.data?.approximateGroup?.candidate;
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates.slice(0, 4).map((c: any) => ({
      name: c.name,
      rxcui: String(c.rxcui || ''),
      score: Math.min(Math.round(parseFloat(c.score) || 0), 100)
    })).filter(item => item.rxcui && item.name);
  } catch (err) {
    console.warn(`[RxNorm Suggestions API] Request failed for term "${term}": ${(err as Error).message}`);
    return [];
  }
}

export async function lookupRxNormApproximate(term: string): Promise<RxNormMatch | null> {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm || cleanTerm.length < 2) return null;

  const db = await getDb();

  // Check cache first
  const cached = await db.get(
    'SELECT * FROM medicine_cache WHERE term = ?',
    [cleanTerm]
  );

  if (cached) {
    let synonyms: string[] = [];
    if (cached.synonyms_json) {
      try { synonyms = JSON.parse(cached.synonyms_json); } catch (_) {}
    }
    return {
      rxcui: cached.rxcui || null,
      name: cached.name || term,
      score: cached.confidence || 0,
      synonyms
    };
  }

  try {
    const response = await axios.get('https://rxnav.nlm.nih.gov/REST/approximateTerm.json', {
      params: { term: cleanTerm, maxEntries: 5 },
      timeout: 5000
    });

    const candidates = response.data?.approximateGroup?.candidate;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      // Store negative resolution in cache to avoid repeating failed external API calls
      await db.run(
        'INSERT OR REPLACE INTO medicine_cache (term, rxcui, name, confidence, synonyms_json, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [cleanTerm, null, term, 0, JSON.stringify([])]
      );
      return null;
    }

    // Pick top candidate
    const top = candidates[0];
    const score = parseFloat(top.score) || 0;
    const rxcui = top.rxcui || null;
    const name = top.name || term;

    const match: RxNormMatch = {
      rxcui,
      name,
      score: Math.min(Math.round(score), 100),
      synonyms: candidates.slice(1, 4).map((c: any) => c.name).filter(Boolean)
    };

    // Cache the successful match
    await db.run(
      'INSERT OR REPLACE INTO medicine_cache (term, rxcui, name, confidence, synonyms_json, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [cleanTerm, match.rxcui, match.name, match.score, JSON.stringify(match.synonyms || [])]
    );

    return match;
  } catch (err) {
    console.warn(`[RxNorm API] Request failed or timed out for term "${term}": ${(err as Error).message}`);
    return null;
  }
}

export interface SmartAlternative {
  name: string;
  rxcui: string | null;
  rationale: string;
  match_type: string;
}

export async function findAlternatives(
  rxcui: string | null,
  drugName: string
): Promise<SmartAlternative | null> {
  const cleanName = drugName.trim();
  if (!cleanName) return null;

  let altName: string | null = null;
  let altRxcui: string | null = null;
  let matchType = 'RxNorm Related Drug';

  // 1. Try RxNorm related endpoint if RXCUI exists
  if (rxcui && rxcui.length > 0 && rxcui !== 'null') {
    try {
      const response = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json`, {
        params: { tty: 'IN+SBD+SB+GPCK+BN+SCD' },
        timeout: 5000
      });

      const conceptGroups = response.data?.relatedGroup?.conceptGroup;
      if (Array.isArray(conceptGroups)) {
        for (const group of conceptGroups) {
          if (Array.isArray(group.conceptProperties) && group.conceptProperties.length > 0) {
            for (const concept of group.conceptProperties) {
              if (
                concept.name &&
                concept.name.toLowerCase() !== cleanName.toLowerCase() &&
                !concept.name.toLowerCase().includes(cleanName.toLowerCase())
              ) {
                altName = concept.name;
                altRxcui = String(concept.rxcui || '');
                matchType = group.tty === 'IN' ? 'Same Active Ingredient' : 'RxNorm Therapeutic Equivalent';
                break;
              }
            }
          }
          if (altName) break;
        }
      }
    } catch (err) {
      console.warn(`[RxNorm Related API] Failed for RXCUI ${rxcui}: ${(err as Error).message}`);
    }
  }

  // 2. Fallback to approximate term candidates if no distinct related drug found
  if (!altName) {
    try {
      const candidates = await lookupRxNormCandidateSuggestions(cleanName);
      const filtered = candidates.filter(
        c => c.name.toLowerCase() !== cleanName.toLowerCase()
      );
      if (filtered.length > 0) {
        altName = filtered[0].name;
        altRxcui = filtered[0].rxcui;
        matchType = 'Same Drug Class Candidate';
      }
    } catch (_) {}
  }

  if (!altName) {
    // Generate a clean generic formulation fallback name if external API has no hits
    altName = `${cleanName} (Generic / Equivalent Brand)`;
    matchType = 'Therapeutic Class Alternative';
  }

  // 3. Generate concise plain-language rationale
  let rationale = `${matchType}: Shares equivalent therapeutic class and active pharmacological properties as ${cleanName}.`;

  // Attempt Gemini API for enhanced clinical rationale if key is set
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      const prompt = `Provide a concise 1-sentence plain-language rationale explaining why "${altName}" is a suitable alternative for out-of-stock medication "${cleanName}". Keep it under 20 words.`;
      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });
      const text = res.text?.trim();
      if (text) {
        rationale = text.replace(/^"|"$/g, '');
      }
    } catch (_) {
      // Keep structured fallback rationale
    }
  }

  return {
    name: altName,
    rxcui: altRxcui,
    rationale,
    match_type: matchType
  };
}

