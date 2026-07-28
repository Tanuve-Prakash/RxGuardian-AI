import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { extractPrescriptionText } from '../services/extractor';
import { parsePrescriptionLines, parseExtractedMedicines } from '../services/parser';
import { fetchOpenFDADrugLabel } from '../services/openfda';
import { runSafetyChecks } from '../services/safety';
import { calculateRxScore } from '../services/rxscore';
import { reviewPrescriptionWithGemini, explainUncertaintyWithGemini } from '../services/geminiReview';
import { getDb } from '../database/db';

const router = Router();

// All analysis endpoints require authentication
router.use(requireAuth as any);

// POST /api/analyses/extract - Upload & run OCR
router.post('/extract', upload.single('prescription'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded. Please select a prescription image.' });
    }

    const ocrResult = await extractPrescriptionText(req.file.path);
    return res.json(ocrResult);
  } catch (err) {
    console.error('[Analysis Extract Error]', err);
    return res.status(500).json({
      error: (err as Error).message || 'Failed to extract text from prescription image. Please try again.'
    });
  }
});

// POST /api/analyses/parse - Convert OCR/Gemini extracted medicines into verified candidate rows
router.post('/parse', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { extracted_medicines, medicines: inputMeds, lines, raw_text } = req.body;
    let medicines;

    if (Array.isArray(extracted_medicines) && extracted_medicines.length > 0) {
      medicines = await parseExtractedMedicines(extracted_medicines);
    } else if (Array.isArray(inputMeds) && inputMeds.length > 0 && typeof inputMeds[0] === 'object' && ('best_guess_name' in inputMeds[0] || 'raw_text' in inputMeds[0])) {
      medicines = await parseExtractedMedicines(inputMeds);
    } else {
      let lineArray = Array.isArray(lines) ? lines : [];
      if (lineArray.length === 0 && typeof raw_text === 'string' && raw_text.trim()) {
        lineArray = raw_text.split('\n').filter(Boolean).map((t: string) => ({ text: t.trim(), confidence: 0.9 }));
      }
      medicines = await parsePrescriptionLines(lineArray);
    }

    return res.json({ medicines });
  } catch (err) {
    console.error('[Analysis Parse Error]', err);
    return res.status(500).json({ error: 'Failed to parse prescription lines.' });
  }
});

// POST /api/analyses/verify - Enrich medicines with OpenFDA clinical labels
router.post('/verify', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { medicines } = req.body;
    if (!Array.isArray(medicines)) {
      return res.status(400).json({ error: 'Medicines array is required for verification.' });
    }

    const enrichedMedicines = await Promise.all(
      medicines.map(async (med) => {
        const label = await fetchOpenFDADrugLabel(med.name);
        return {
          ...med,
          openfda: label
        };
      })
    );

    return res.json({ medicines: enrichedMedicines });
  } catch (err) {
    console.error('[Analysis Verify Error]', err);
    return res.status(500).json({ error: 'Failed to verify medicines with OpenFDA.' });
  }
});

// POST /api/analyses/check-safety - Run safety checks, compute RxScore & generate Gemini Review
router.post('/check-safety', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { medicines, patientContext, ocrConfidence, raw_ocr_text } = req.body;
    if (!Array.isArray(medicines)) {
      return res.status(400).json({ error: 'Medicines array is required for safety check.' });
    }

    const safetyResult = await runSafetyChecks(medicines, patientContext);
    const scoreResult = calculateRxScore(medicines, safetyResult.alerts, ocrConfidence || 1.0);
    const geminiReview = await reviewPrescriptionWithGemini(raw_ocr_text || '', medicines, patientContext);

    return res.json({
      alerts: safetyResult.alerts,
      rxscore: scoreResult,
      assessment_summary: safetyResult.assessment_summary,
      gemini_review: geminiReview
    });
  } catch (err) {
    console.error('[Analysis Check Safety Error]', err);
    return res.status(500).json({ error: 'Failed to complete safety assessment.' });
  }
});

// POST /api/analyses/gemini-review - Explicit trigger for Gemini Prescription Review
router.post('/gemini-review', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { raw_ocr_text, medicines, patientContext } = req.body;
    const review = await reviewPrescriptionWithGemini(raw_ocr_text || '', medicines || [], patientContext);
    return res.json({ gemini_review: review });
  } catch (err) {
    console.error('[Gemini Review Route Error]', err);
    return res.status(500).json({ error: 'Failed to generate Gemini prescription review.' });
  }
});

// POST /api/analyses/explain-uncertainty - AI Clinical Assistant for unresolved lines
router.post('/explain-uncertainty', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { raw_text, rxnorm_suggestions, best_guess_name, patientContext } = req.body;
    const explanation = await explainUncertaintyWithGemini(
      raw_text || '',
      rxnorm_suggestions || [],
      patientContext,
      best_guess_name
    );
    return res.json({ explanation });
  } catch (err) {
    console.error('[Explain Uncertainty Route Error]', err);
    return res.status(500).json({ error: 'Failed to generate AI uncertainty explanation.' });
  }
});

// POST /api/analyses/save - Persist analysis to SQLite
router.post('/save', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const {
      patient_name,
      patient_age,
      patient_gender,
      allergies,
      renal_impairment,
      hepatic_impairment,
      is_pregnant,
      raw_ocr_text,
      medicines,
      alerts,
      rxscore,
      band,
      summary
    } = req.body;

    const analysisId = `rx-anal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User session expired.' });
    }

    const db = await getDb();
    await db.run(
      `INSERT INTO analyses (
        id, user_id, patient_name, patient_age, patient_gender, allergies,
        renal_impairment, hepatic_impairment, is_pregnant, raw_ocr_text,
        rxscore, band, medicines_json, alerts_json, summary_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        analysisId,
        userId,
        patient_name || 'Anonymous Patient',
        patient_age || null,
        patient_gender || null,
        allergies || null,
        renal_impairment ? 1 : 0,
        hepatic_impairment ? 1 : 0,
        is_pregnant ? 1 : 0,
        raw_ocr_text || '',
        rxscore || 0,
        band || 'Needs Review',
        JSON.stringify(medicines || []),
        JSON.stringify(alerts || []),
        JSON.stringify(summary || {})
      ]
    );

    return res.status(201).json({
      id: analysisId,
      message: 'Prescription analysis saved successfully.'
    });
  } catch (err) {
    console.error('[Analysis Save Error]', err);
    return res.status(500).json({ error: 'Failed to save analysis record.' });
  }
});

export default router;
