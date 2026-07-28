import crypto from 'crypto';
import QRCode from 'qrcode';
import { getDb } from '../database/db';

export interface CurrentMedication {
  name: string;
  rxcui?: string | null;
  started_at?: string | null;
}

export interface PatientPassportRecord {
  id: string;
  user_id: number;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  allergies: string | null;
  current_medications: CurrentMedication[];
  past_prescriptions_ref: string[];
  previous_reactions: string | null;
  is_pregnant: boolean;
  renal_impairment: boolean;
  hepatic_impairment: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  qr_token: string;
  qr_code_data_url?: string;
  created_at: string;
  updated_at: string;
}

export function generateQrToken(): string {
  return 'rxp_' + crypto.randomBytes(16).toString('hex');
}

export async function renderQrCodeDataUrl(qrToken: string): Promise<string> {
  try {
    return await QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: {
        dark: '#0F6E6E',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('[QR Generation Error]', err);
    return '';
  }
}

function parseRowToPatient(row: any, qrDataUrl?: string): PatientPassportRecord {
  let currentMedications: CurrentMedication[] = [];
  try {
    currentMedications = JSON.parse(row.current_medications || '[]');
  } catch (_) {}

  let pastPrescriptionsRef: string[] = [];
  try {
    pastPrescriptionsRef = JSON.parse(row.past_prescriptions_ref || '[]');
  } catch (_) {}

  return {
    id: row.id,
    user_id: Number(row.user_id),
    full_name: row.full_name,
    date_of_birth: row.date_of_birth || null,
    gender: row.gender || null,
    allergies: row.allergies || null,
    current_medications: currentMedications,
    past_prescriptions_ref: pastPrescriptionsRef,
    previous_reactions: row.previous_reactions || null,
    is_pregnant: Boolean(row.is_pregnant),
    renal_impairment: Boolean(row.renal_impairment),
    hepatic_impairment: Boolean(row.hepatic_impairment),
    emergency_contact_name: row.emergency_contact_name || null,
    emergency_contact_phone: row.emergency_contact_phone || null,
    qr_token: row.qr_token,
    qr_code_data_url: qrDataUrl,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listPatients(userId: number, search?: string): Promise<PatientPassportRecord[]> {
  const db = await getDb();
  let query = 'SELECT * FROM patients WHERE user_id = ?';
  const params: any[] = [userId];

  if (search && search.trim().length > 0) {
    query += ' AND (full_name LIKE ? OR allergies LIKE ? OR qr_token LIKE ?)';
    const pattern = `%${search.trim()}%`;
    params.push(pattern, pattern, pattern);
  }

  query += ' ORDER BY updated_at DESC';

  const rows = await db.all(query, params);
  return Promise.all(rows.map(async (row) => {
    const qrDataUrl = await renderQrCodeDataUrl(row.qr_token);
    return parseRowToPatient(row, qrDataUrl);
  }));
}

export async function getPatientById(userId: number, patientId: string): Promise<PatientPassportRecord | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM patients WHERE id = ? AND user_id = ?', [patientId, userId]);
  if (!row) return null;

  const qrDataUrl = await renderQrCodeDataUrl(row.qr_token);
  return parseRowToPatient(row, qrDataUrl);
}

export async function getPatientByToken(qrToken: string): Promise<PatientPassportRecord | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM patients WHERE qr_token = ?', [qrToken.trim()]);
  if (!row) return null;

  const qrDataUrl = await renderQrCodeDataUrl(row.qr_token);
  return parseRowToPatient(row, qrDataUrl);
}

export async function createPatient(
  userId: number,
  data: {
    full_name: string;
    date_of_birth?: string | null;
    gender?: string | null;
    allergies?: string | null;
    current_medications?: CurrentMedication[];
    previous_reactions?: string | null;
    is_pregnant?: boolean;
    renal_impairment?: boolean;
    hepatic_impairment?: boolean;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  }
): Promise<PatientPassportRecord> {
  const db = await getDb();
  const patientId = `pat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const qrToken = generateQrToken();

  const currentMedsJson = JSON.stringify(data.current_medications || []);
  const pastPrescriptionsJson = JSON.stringify([]);

  await db.run(
    `INSERT INTO patients (
      id, user_id, full_name, date_of_birth, gender, allergies,
      current_medications, past_prescriptions_ref, previous_reactions,
      is_pregnant, renal_impairment, hepatic_impairment,
      emergency_contact_name, emergency_contact_phone, qr_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      userId,
      data.full_name.trim(),
      data.date_of_birth || null,
      data.gender || null,
      data.allergies || null,
      currentMedsJson,
      pastPrescriptionsJson,
      data.previous_reactions || null,
      data.is_pregnant ? 1 : 0,
      data.renal_impairment ? 1 : 0,
      data.hepatic_impairment ? 1 : 0,
      data.emergency_contact_name || null,
      data.emergency_contact_phone || null,
      qrToken
    ]
  );

  const newPatient = await getPatientById(userId, patientId);
  if (!newPatient) throw new Error('Failed to create patient record.');
  return newPatient;
}

export async function updatePatient(
  userId: number,
  patientId: string,
  data: {
    full_name?: string;
    date_of_birth?: string | null;
    gender?: string | null;
    allergies?: string | null;
    current_medications?: CurrentMedication[];
    previous_reactions?: string | null;
    is_pregnant?: boolean;
    renal_impairment?: boolean;
    hepatic_impairment?: boolean;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  }
): Promise<PatientPassportRecord | null> {
  const db = await getDb();
  const existing = await getPatientById(userId, patientId);
  if (!existing) return null;

  const fullName = data.full_name !== undefined ? data.full_name.trim() : existing.full_name;
  const dob = data.date_of_birth !== undefined ? data.date_of_birth : existing.date_of_birth;
  const gender = data.gender !== undefined ? data.gender : existing.gender;
  const allergies = data.allergies !== undefined ? data.allergies : existing.allergies;
  const currentMeds = data.current_medications !== undefined ? data.current_medications : existing.current_medications;
  const prevReactions = data.previous_reactions !== undefined ? data.previous_reactions : existing.previous_reactions;
  const isPregnant = data.is_pregnant !== undefined ? data.is_pregnant : existing.is_pregnant;
  const renal = data.renal_impairment !== undefined ? data.renal_impairment : existing.renal_impairment;
  const hepatic = data.hepatic_impairment !== undefined ? data.hepatic_impairment : existing.hepatic_impairment;
  const emName = data.emergency_contact_name !== undefined ? data.emergency_contact_name : existing.emergency_contact_name;
  const emPhone = data.emergency_contact_phone !== undefined ? data.emergency_contact_phone : existing.emergency_contact_phone;

  await db.run(
    `UPDATE patients SET
      full_name = ?,
      date_of_birth = ?,
      gender = ?,
      allergies = ?,
      current_medications = ?,
      previous_reactions = ?,
      is_pregnant = ?,
      renal_impairment = ?,
      hepatic_impairment = ?,
      emergency_contact_name = ?,
      emergency_contact_phone = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?`,
    [
      fullName,
      dob,
      gender,
      allergies,
      JSON.stringify(currentMeds),
      prevReactions,
      isPregnant ? 1 : 0,
      renal ? 1 : 0,
      hepatic ? 1 : 0,
      emName,
      emPhone,
      patientId,
      userId
    ]
  );

  return getPatientById(userId, patientId);
}

export async function deletePatient(userId: number, patientId: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.run('DELETE FROM patients WHERE id = ? AND user_id = ?', [patientId, userId]);
  return res.changes > 0;
}

export async function linkAnalysisToPatient(patientId: string, analysisId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get('SELECT id, past_prescriptions_ref, current_medications FROM patients WHERE id = ?', [patientId]);
  if (!row) return false;

  let pastRefs: string[] = [];
  try {
    pastRefs = JSON.parse(row.past_prescriptions_ref || '[]');
  } catch (_) {}

  if (!pastRefs.includes(analysisId)) {
    pastRefs.push(analysisId);
  }

  // Also pull confirmed medicines from the analysis to optionally update current_medications if available
  let currentMeds: CurrentMedication[] = [];
  try {
    currentMeds = JSON.parse(row.current_medications || '[]');
  } catch (_) {}

  const analysisRow = await db.get('SELECT medicines_json FROM analyses WHERE id = ?', [analysisId]);
  if (analysisRow && analysisRow.medicines_json) {
    try {
      const medicines = JSON.parse(analysisRow.medicines_json);
      medicines.forEach((m: any) => {
        const name = m.name || m.best_guess_name;
        if (name && !currentMeds.some(cm => cm.name.toLowerCase() === name.toLowerCase())) {
          currentMeds.push({
            name,
            rxcui: m.rxcui || null,
            started_at: new Date().toISOString().split('T')[0]
          });
        }
      });
    } catch (_) {}
  }

  await db.run(
    'UPDATE patients SET past_prescriptions_ref = ?, current_medications = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(pastRefs), JSON.stringify(currentMeds), patientId]
  );

  return true;
}
