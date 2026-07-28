import axios from 'axios';
import { getDb } from '../database/db';

export interface OpenFDALabelData {
  drug_interactions: string | null;
  warnings: string | null;
  dosage_and_administration: string | null;
  contraindications: string | null;
  pregnancy_or_breastfeeding: string | null;
  found: boolean;
}

export async function fetchOpenFDADrugLabel(drugName: string): Promise<OpenFDALabelData> {
  const cleanName = drugName.trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) {
    return {
      drug_interactions: null,
      warnings: null,
      dosage_and_administration: null,
      contraindications: null,
      pregnancy_or_breastfeeding: null,
      found: false
    };
  }

  const db = await getDb();

  // Check 24-hour SQLite cache
  const cached = await db.get(
    'SELECT * FROM openfda_cache WHERE rxcui_or_name = ? AND datetime(updated_at, "+24 hours") > datetime("now")',
    [cleanName]
  );

  if (cached && cached.data_json) {
    try {
      return JSON.parse(cached.data_json);
    } catch (_) {}
  }

  try {
    // Sanitize search term to extract core drug name if possible
    const searchTerm = cleanName
      .replace(/\(.*\)/g, '')
      .replace(/\b(tab|tablets?|caps?|capsules?|oral|chewable|solution|suspension|injectable|for|take|as|needed|pain)\b/gi, '')
      .trim() || cleanName;

    // Construct search query for OpenFDA
    const query = `openfda.brand_name:"${searchTerm}" OR openfda.generic_name:"${searchTerm}"`;
    const response = await axios.get('https://api.fda.gov/drug/label.json', {
      params: { search: query, limit: 1 },
      timeout: 10000 // 10-second timeout for OpenFDA API
    });

    const result = response.data?.results?.[0];
    if (!result) {
      const nullResult: OpenFDALabelData = {
        drug_interactions: null,
        warnings: null,
        dosage_and_administration: null,
        contraindications: null,
        pregnancy_or_breastfeeding: null,
        found: false
      };

      await db.run(
        'INSERT OR REPLACE INTO openfda_cache (rxcui_or_name, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [cleanName, JSON.stringify(nullResult)]
      );

      return nullResult;
    }

    const extractField = (fieldArray: any): string | null => {
      if (Array.isArray(fieldArray) && fieldArray.length > 0 && typeof fieldArray[0] === 'string') {
        const text = fieldArray[0].trim();
        return text.length > 0 ? text.substring(0, 1000) : null;
      }
      return null;
    };

    const labelData: OpenFDALabelData = {
      drug_interactions: extractField(result.drug_interactions),
      warnings: extractField(result.warnings) || extractField(result.warnings_and_cautions),
      dosage_and_administration: extractField(result.dosage_and_administration),
      contraindications: extractField(result.contraindications),
      pregnancy_or_breastfeeding: extractField(result.pregnancy_or_breast_feeding) || extractField(result.pregnancy),
      found: true
    };

    await db.run(
      'INSERT OR REPLACE INTO openfda_cache (rxcui_or_name, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [cleanName, JSON.stringify(labelData)]
    );

    return labelData;

  } catch (err: any) {
    if (err.response?.status === 404) {
      // 404 status from OpenFDA means no record matched the drug query, which is normal for non-drug or unlisted items.
      const noDataResult: OpenFDALabelData = {
        drug_interactions: null,
        warnings: null,
        dosage_and_administration: null,
        contraindications: null,
        pregnancy_or_breastfeeding: null,
        found: false
      };
      await db.run(
        'INSERT OR REPLACE INTO openfda_cache (rxcui_or_name, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [cleanName, JSON.stringify(noDataResult)]
      );
      return noDataResult;
    }

    console.warn(`[OpenFDA API] Request failed or timed out for "${drugName}": ${(err as Error).message}`);

    // Return explicit no-data status (Guardrail 2: Never return a canned warning!)
    const noDataResult: OpenFDALabelData = {
      drug_interactions: null,
      warnings: null,
      dosage_and_administration: null,
      contraindications: null,
      pregnancy_or_breastfeeding: null,
      found: false
    };

    return noDataResult;
  }
}
