// Where does a production (MRP) order stand? Shared by the API and the frontend so the Production list,
// its filter buttons and the Home card always agree. Mirrors purchase-order-status.ts.
import { localIsoDate } from './purchase-order-status';

export type ProdState = 'Not started' | 'In progress' | 'Completed';

export interface IProdSummary {
  state: ProdState;
  percent_complete: number;
  qty_total: number;
  qty_complete: number;
  overdue: boolean;
  days_late: number;
}

interface ProdLike {
  expected_due_date?: string;
  items?: Array<{ qty?: number; qty_received?: number; qty_remaining?: number }>;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso + 'T00:00:00');
  const to = Date.parse(toIso + 'T00:00:00');
  return Math.round((to - from) / 86400000);
}

export function summariseProdOrder(order: ProdLike, today: string = localIsoDate()): IProdSummary {
  const items = order.items || [];
  const qtyTotal = items.reduce((sum, i) => sum + (i.qty || 0), 0);
  const qtyComplete = items.reduce((sum, i) => sum + (i.qty_received || 0), 0);
  const stillToMake = items.some(i => (i.qty_remaining || 0) > 0);

  let state: ProdState;
  if (items.length > 0 && !stillToMake) {
    state = 'Completed';
  } else if (qtyComplete > 0) {
    state = 'In progress';
  } else {
    state = 'Not started';
  }

  let daysLate = 0;
  if (state !== 'Completed' && order.expected_due_date) {
    daysLate = Math.max(0, -daysBetween(today, order.expected_due_date));
  }

  return {
    state,
    percent_complete: qtyTotal > 0 ? Math.min(100, Math.round((qtyComplete / qtyTotal) * 100)) : 0,
    qty_total: qtyTotal,
    qty_complete: qtyComplete,
    overdue: daysLate > 0,
    days_late: daysLate,
  };
}
