import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getDb } from '../database/db';
import {
  listPatients,
  getPatientById,
  getPatientByToken,
  createPatient,
  updatePatient,
  deletePatient,
  linkAnalysisToPatient
} from '../services/patients';

const router = Router();

router.use(requireAuth as any);

// GET /api/patients - List patients
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const patients = await listPatients(userId, search);
    return res.json({ patients });
  } catch (err) {
    console.error('[Patients List Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve patients list.' });
  }
});

// GET /api/patients/by-token/:qr_token - Look up patient by opaque QR token
router.get('/by-token/:qr_token', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { qr_token } = req.params;
    if (!qr_token) return res.status(400).json({ error: 'QR token is required.' });

    const patient = await getPatientByToken(qr_token);
    if (!patient) {
      return res.status(404).json({ error: 'RxGuardian Passport not found for this QR token.' });
    }

    return res.json({ patient });
  } catch (err) {
    console.error('[Patient By Token Error]', err);
    return res.status(500).json({ error: 'Failed to look up patient by QR token.' });
  }
});

// GET /api/patients/:id - Get patient detail with linked past analyses
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patient = await getPatientById(userId, id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }

    // Fetch linked past analyses records
    let pastAnalyses: any[] = [];
    if (patient.past_prescriptions_ref && patient.past_prescriptions_ref.length > 0) {
      const db = await getDb();
      const placeholders = patient.past_prescriptions_ref.map(() => '?').join(',');
      const rows = await db.all(
        `SELECT id, patient_name, rxscore, band, created_at, medicines_json, alerts_json FROM analyses WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
        patient.past_prescriptions_ref
      );
      pastAnalyses = rows.map(r => ({
        ...r,
        medicines: JSON.parse(r.medicines_json || '[]'),
        alerts: JSON.parse(r.alerts_json || '[]')
      }));
    }

    return res.json({ patient, past_analyses: pastAnalyses });
  } catch (err) {
    console.error('[Patient Detail Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve patient detail.' });
  }
});

// POST /api/patients - Create patient
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      full_name,
      date_of_birth,
      gender,
      allergies,
      current_medications,
      previous_reactions,
      is_pregnant,
      renal_impairment,
      hepatic_impairment,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
      return res.status(400).json({ error: 'Patient full_name is required.' });
    }

    const patient = await createPatient(userId, {
      full_name,
      date_of_birth,
      gender,
      allergies,
      current_medications,
      previous_reactions,
      is_pregnant,
      renal_impairment,
      hepatic_impairment,
      emergency_contact_name,
      emergency_contact_phone
    });

    return res.status(201).json({ patient, message: 'Patient Passport created successfully.' });
  } catch (err) {
    console.error('[Patient Create Error]', err);
    return res.status(500).json({ error: 'Failed to create Patient Passport.' });
  }
});

// PUT /api/patients/:id - Update patient
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patient = await updatePatient(userId, id, req.body);
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }

    return res.json({ patient, message: 'Patient Passport updated successfully.' });
  } catch (err) {
    console.error('[Patient Update Error]', err);
    return res.status(500).json({ error: 'Failed to update Patient Passport.' });
  }
});

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const success = await deletePatient(userId, id);
    if (!success) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }

    return res.json({ message: 'Patient Passport deleted successfully.' });
  } catch (err) {
    console.error('[Patient Delete Error]', err);
    return res.status(500).json({ error: 'Failed to delete Patient Passport.' });
  }
});

// POST /api/patients/:id/link-analysis - Link an analysis to patient
router.post('/:id/link-analysis', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { analysis_id } = req.body;

    if (!analysis_id || typeof analysis_id !== 'string') {
      return res.status(400).json({ error: 'analysis_id is required.' });
    }

    const success = await linkAnalysisToPatient(id, analysis_id);
    if (!success) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }

    return res.json({ message: 'Analysis linked to Patient Passport successfully.' });
  } catch (err) {
    console.error('[Link Analysis Error]', err);
    return res.status(500).json({ error: 'Failed to link analysis to Patient Passport.' });
  }
});

export default router;
