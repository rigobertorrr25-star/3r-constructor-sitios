// Inventario y activos: tipos y textos visibles.

export const UNITS = ['unidad', 'kg', 'g', 'litro', 'ml', 'caja', 'paquete', 'bolsa', 'metro', 'par'] as const;

export type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  stock: number;
  minStock: number | null;
  cost: number | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  low: boolean;
  updatedAt: string;
};
export type ItemList = { items: InventoryItem[]; totals: { count: number; low: number; value: number } };
export type Movement = {
  id: string;
  type: 'in' | 'out' | 'count';
  quantity: number;
  stockAfter: number;
  note: string | null;
  by: string | null;
  createdAt: string;
};
export type ItemDetail = InventoryItem & { movements: Movement[] };
export const MOVE_LABEL: Record<Movement['type'], string> = { in: 'Entrada', out: 'Salida', count: 'Conteo' };

export type AssetStatus = 'available' | 'assigned' | 'repair' | 'retired';
export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  available: 'Disponible',
  assigned: 'Entregado',
  repair: 'En reparación',
  retired: 'De baja',
};
export type Asset = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  serial: string | null;
  status: AssetStatus;
  assignedMemberId: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  value: number | null;
  purchasedAt: string | null;
  notes: string | null;
  updatedAt: string;
};
export type AssetList = { manage: boolean; assets: Asset[]; counts: Partial<Record<AssetStatus, number>> };
export type AssetEvent = {
  id: string;
  kind: 'created' | 'assigned' | 'returned' | AssetStatus;
  person: string | null;
  note: string | null;
  by: string | null;
  createdAt: string;
};
export type AssetDetail = Asset & { manage: boolean; events: AssetEvent[] };
export const EVENT_LABEL: Record<AssetEvent['kind'], string> = {
  created: 'Registrado',
  assigned: 'Entregado a',
  returned: 'Devuelto por',
  available: 'Disponible',
  repair: 'A reparación',
  retired: 'Dado de baja',
};

export type InventorySummary = { manage: boolean; myAssets: number; lowStock?: number };

/** 1.5 → "1,5"; 2 → "2". */
export const qtyText = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(n);
/** "1,5" o "1.5" → 1.5; vacío → null. */
export const parseQty = (s: string) => {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return null;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};
