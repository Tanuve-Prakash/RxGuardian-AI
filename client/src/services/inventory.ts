import api from './api';

export interface InventoryItem {
  id?: number;
  user_id?: number;
  drug_name: string;
  rxcui: string | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity: number;
  updated_at?: string;
}

export interface SmartAlternative {
  name: string;
  rxcui: string | null;
  rationale: string;
  match_type: string;
}

export interface StockCheckResult {
  drug_name: string;
  rxcui: string | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity: number;
  is_out_of_stock: boolean;
  alternative?: SmartAlternative | null;
}

export async function fetchInventoryApi(): Promise<InventoryItem[]> {
  const response = await api.get('/inventory');
  return response.data.inventory || [];
}

export async function updateInventoryApi(item: {
  drug_name: string;
  rxcui?: string | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity: number;
}): Promise<InventoryItem> {
  const response = await api.post('/inventory', item);
  return response.data.item;
}

export async function checkStockApi(
  medicines: Array<{ name: string; rxcui?: string | null }>
): Promise<StockCheckResult[]> {
  const response = await api.post('/inventory/check-stock', { medicines });
  return response.data.stock_checks || [];
}
