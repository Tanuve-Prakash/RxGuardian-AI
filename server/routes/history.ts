import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getDb } from '../database/db';

const router = Router();

router.use(requireAuth as any);

// GET /api/analyses - Fetch saved history with search and band filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { search, band } = req.query;

    const db = await getDb();
    let query = 'SELECT id, patient_name, patient_age, patient_gender, rxscore, band, created_at, medicines_json, alerts_json FROM analyses WHERE user_id = ?';
    const params: any[] = [userId];

    if (search && typeof search === 'string' && search.trim().length > 0) {
      query += ' AND (patient_name LIKE ? OR raw_ocr_text LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    if (band && typeof band === 'string' && band !== 'all') {
      query += ' AND band = ?';
      params.push(band);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await db.all(query, params);

    const analyses = rows.map(r => ({
      ...r,
      medicines: JSON.parse(r.medicines_json || '[]'),
      alerts: JSON.parse(r.alerts_json || '[]')
    }));

    return res.json({ analyses });
  } catch (err) {
    console.error('[History List Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve analysis history.' });
  }
});

// GET /api/analyses/:id - Get single analysis detail
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const db = await getDb();
    const row = await db.get(
      'SELECT * FROM analyses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!row) {
      return res.status(404).json({ error: 'Analysis record not found.' });
    }

    return res.json({
      analysis: {
        ...row,
        medicines: JSON.parse(row.medicines_json || '[]'),
        alerts: JSON.parse(row.alerts_json || '[]'),
        summary: JSON.parse(row.summary_json || '{}')
      }
    });
  } catch (err) {
    console.error('[History Detail Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve analysis details.' });
  }
});

// DELETE /api/analyses/:id - Delete an analysis record
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const db = await getDb();
    const result = await db.run(
      'DELETE FROM analyses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Record not found or not authorized to delete.' });
    }

    return res.json({ message: 'Analysis record deleted successfully.' });
  } catch (err) {
    console.error('[History Delete Error]', err);
    return res.status(500).json({ error: 'Failed to delete analysis record.' });
  }
});

// GET /api/dashboard/stats - Real user stats for Dashboard
router.get('/stats/summary', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const db = await getDb();

    const rows = await db.all(
      'SELECT rxscore, alerts_json FROM analyses WHERE user_id = ?',
      [userId]
    );

    const totalAnalyzed = rows.length;

    if (totalAnalyzed === 0) {
      return res.json({
        total_analyzed: 0,
        alerts_flagged: 0,
        average_rxscore: 0,
        most_common_alert: 'None'
      });
    }

    let totalScore = 0;
    let totalAlertsCount = 0;
    const alertTypeCounts: Record<string, number> = {};

    rows.forEach(r => {
      totalScore += r.rxscore || 0;
      let alertsList = [];
      try { alertsList = JSON.parse(r.alerts_json || '[]'); } catch (_) {}

      totalAlertsCount += alertsList.length;

      alertsList.forEach((a: any) => {
        const type = a.type || 'Other Alert';
        alertTypeCounts[type] = (alertTypeCounts[type] || 0) + 1;
      });
    });

    const averageRxScore = Math.round(totalScore / totalAnalyzed);

    let mostCommonAlert = 'None';
    let maxCount = 0;
    Object.entries(alertTypeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonAlert = type.replace(/_/g, ' ').toUpperCase();
      }
    });

    return res.json({
      total_analyzed: totalAnalyzed,
      alerts_flagged: totalAlertsCount,
      average_rxscore: averageRxScore,
      most_common_alert: mostCommonAlert
    });
  } catch (err) {
    console.error('[Dashboard Stats Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve stats summary.' });
  }
});

export default router;
