import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  listPharmacyInventory,
  upsertInventoryItem,
  checkStockItem,
  StockCheckResult
} from '../services/inventory';

const router = Router();

// Allow authenticated requests or fallback to user 1 for demo resilience
router.use((req: any, res: Response, next) => {
  requireAuth(req as AuthenticatedRequest, res, () => {
    next();
  });
});

// GET /api/inventory - List local pharmacy inventory
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id || 1;
    const inventory = await listPharmacyInventory(userId);
    return res.json({ inventory });
  } catch (err) {
    console.error('[Inventory List Error]', err);
    return res.status(500).json({ error: 'Failed to retrieve pharmacy inventory.' });
  }
});

// POST /api/inventory - Upsert inventory stock item
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id || 1;
    const { drug_name, rxcui, stock_status, quantity } = req.body;

    if (!drug_name || typeof drug_name !== 'string') {
      return res.status(400).json({ error: 'drug_name is required.' });
    }

    const validStatus = ['in_stock', 'low_stock', 'out_of_stock'].includes(stock_status)
      ? stock_status
      : 'in_stock';
    const numQty = typeof quantity === 'number' ? quantity : parseInt(quantity) || 0;

    const item = await upsertInventoryItem(userId, drug_name, rxcui || null, validStatus, numQty);
    return res.json({ item, message: 'Pharmacy stock updated successfully.' });
  } catch (err) {
    console.error('[Inventory Upsert Error]', err);
    return res.status(500).json({ error: 'Failed to update pharmacy stock.' });
  }
});

// POST /api/inventory/check-stock - Batch check stock for prescription medicines
router.post('/check-stock', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id || 1;
    const { medicines } = req.body;

    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.json({ stock_checks: [] });
    }

    const results: StockCheckResult[] = await Promise.all(
      medicines.map((m: { name: string; rxcui?: string | null }) =>
        checkStockItem(m.name || '', m.rxcui || null, userId)
      )
    );

    return res.json({ stock_checks: results });
  } catch (err) {
    console.error('[Check Stock Error]', err);
    return res.status(500).json({ error: 'Failed to perform inventory stock check.' });
  }
});

export default router;
