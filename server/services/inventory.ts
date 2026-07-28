import { getDb } from '../database/db';
import { findAlternatives, SmartAlternative } from './rxnorm';

export interface InventoryItem {
  id?: number;
  user_id: number;
  drug_name: string;
  rxcui: string | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity: number;
  updated_at?: string;
}

export interface StockCheckResult {
  drug_name: string;
  rxcui: string | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity: number;
  is_out_of_stock: boolean;
  alternative?: SmartAlternative | null;
}

const DEFAULT_DEMO_INVENTORY = [
  { drug_name: 'Warfarin 5mg Tablet', rxcui: '11289', stock_status: 'in_stock', quantity: 150 },
  { drug_name: 'Amoxicillin 500mg Capsule', rxcui: '308182', stock_status: 'out_of_stock', quantity: 0 },
  { drug_name: 'Amoxicillin', rxcui: '308182', stock_status: 'out_of_stock', quantity: 0 },
  { drug_name: 'Ibuprofen 200mg Tablet', rxcui: '310965', stock_status: 'in_stock', quantity: 500 },
  { drug_name: 'Metformin 500mg Tablet', rxcui: '860975', stock_status: 'low_stock', quantity: 12 },
  { drug_name: 'Lisinopril 10mg Tablet', rxcui: '314076', stock_status: 'in_stock', quantity: 200 },
  { drug_name: 'Atorvastatin 20mg Tablet', rxcui: '617314', stock_status: 'out_of_stock', quantity: 0 },
  { drug_name: 'Atorvastatin', rxcui: '617314', stock_status: 'out_of_stock', quantity: 0 },
  { drug_name: 'Omeprazole 20mg Capsule', rxcui: '312140', stock_status: 'in_stock', quantity: 300 }
];

export async function listPharmacyInventory(userId: number): Promise<InventoryItem[]> {
  const db = await getDb();
  let rows = await db.all('SELECT * FROM pharmacy_inventory WHERE user_id = ? ORDER BY drug_name ASC', [userId]);

  if (rows.length === 0) {
    // Seed default demo inventory for this pharmacy account
    for (const item of DEFAULT_DEMO_INVENTORY) {
      await db.run(
        'INSERT INTO pharmacy_inventory (user_id, drug_name, rxcui, stock_status, quantity) VALUES (?, ?, ?, ?, ?)',
        [userId, item.drug_name, item.rxcui, item.stock_status, item.quantity]
      );
    }
    rows = await db.all('SELECT * FROM pharmacy_inventory WHERE user_id = ? ORDER BY drug_name ASC', [userId]);
  }

  return rows as InventoryItem[];
}

export async function upsertInventoryItem(
  userId: number,
  drug_name: string,
  rxcui: string | null,
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock',
  quantity: number
): Promise<InventoryItem> {
  const db = await getDb();
  const cleanName = drug_name.trim();

  const existing = await db.get(
    'SELECT id FROM pharmacy_inventory WHERE user_id = ? AND LOWER(drug_name) = LOWER(?)',
    [userId, cleanName]
  );

  if (existing) {
    await db.run(
      'UPDATE pharmacy_inventory SET stock_status = ?, quantity = ?, rxcui = COALESCE(?, rxcui), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [stock_status, quantity, rxcui, existing.id]
    );
    const updated = await db.get('SELECT * FROM pharmacy_inventory WHERE id = ?', [existing.id]);
    return updated as InventoryItem;
  } else {
    const res = await db.run(
      'INSERT INTO pharmacy_inventory (user_id, drug_name, rxcui, stock_status, quantity) VALUES (?, ?, ?, ?, ?)',
      [userId, cleanName, rxcui, stock_status, quantity]
    );
    const created = await db.get('SELECT * FROM pharmacy_inventory WHERE id = ?', [res.lastID]);
    return created as InventoryItem;
  }
}

export async function checkStockItem(
  drugName: string,
  rxcui: string | null,
  userId: number
): Promise<StockCheckResult> {
  const db = await getDb();
  const cleanName = drugName.trim().toLowerCase();

  // Make sure inventory table is seeded if empty
  await listPharmacyInventory(userId);

  // Exact or fuzzy match on pharmacy_inventory
  let row = await db.get(
    'SELECT * FROM pharmacy_inventory WHERE user_id = ? AND (LOWER(drug_name) = ? OR (rxcui IS NOT NULL AND rxcui = ?))',
    [userId, cleanName, rxcui || '']
  );

  if (!row) {
    // Try partial word match (e.g. "Amoxicillin" matching "Amoxicillin 500mg Capsule")
    row = await db.get(
      'SELECT * FROM pharmacy_inventory WHERE user_id = ? AND (LOWER(drug_name) LIKE ? OR LOWER(?) LIKE "%" || LOWER(drug_name) || "%")',
      [userId, `%${cleanName}%`, cleanName]
    );
  }

  let stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
  let quantity = 100;

  if (row) {
    stock_status = row.stock_status;
    quantity = row.quantity;
  }

  const is_out_of_stock = stock_status === 'out_of_stock';
  let alternative: SmartAlternative | null = null;

  if (is_out_of_stock) {
    alternative = await findAlternatives(rxcui || (row?.rxcui || null), drugName);
  }

  return {
    drug_name: drugName,
    rxcui: rxcui || row?.rxcui || null,
    stock_status,
    quantity,
    is_out_of_stock,
    alternative
  };
}
