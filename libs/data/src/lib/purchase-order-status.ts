// One definition of "where does this purchase order stand", shared by the API (list endpoints and the
// dashboard) and the frontend, so the Orders page, the Receiving page and the Home tiles always agree.

export type POState = 'Open' | 'On order' | 'Partially received' | 'Received';
export type PODueBucket = 'overdue' | 'this-week' | 'later';

export interface IPOSummary {
  state: POState;
  percent_received: number;
  qty_total: number;
  qty_received: number;
  total_lines: number;
  open_lines: number;
  overdue: boolean;
  days_late: number;
  // Receiving work-list bucket; null when the PO has no due date or is not waiting to be received.
  bucket: PODueBucket | null;
}

interface POLike {
  status?: string;
  expected_due_date?: string;
  items?: Array<{ qty?: number; qty_received?: number; qty_remaining?: number }>;
}

// Today as YYYY-MM-DD in local time (toISOString would use UTC and shift the day near midnight).
export function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso + 'T00:00:00');
  const to = Date.parse(toIso + 'T00:00:00');
  return Math.round((to - from) / 86400000);
}

export function summarisePurchaseOrder(po: POLike, today: string = localIsoDate()): IPOSummary {
  const items = po.items || [];
  const qtyTotal = items.reduce((sum, i) => sum + (i.qty || 0), 0);
  const qtyReceived = items.reduce((sum, i) => sum + (i.qty_received || 0), 0);
  const openLines = items.filter(i => (i.qty_remaining || 0) > 0).length;

  const released = po.status === 'Released';
  let state: POState;
  if (!released) {
    state = 'Open';
  } else if (items.length > 0 && openLines === 0) {
    state = 'Received';
  } else if (qtyReceived > 0) {
    state = 'Partially received';
  } else {
    state = 'On order';
  }

  let bucket: PODueBucket | null = null;
  let daysLate = 0;
  const waiting = released && state !== 'Received';
  if (waiting && po.expected_due_date) {
    const days = daysBetween(today, po.expected_due_date);
    if (days < 0) {
      bucket = 'overdue';
      daysLate = -days;
    } else {
      bucket = days <= 7 ? 'this-week' : 'later';
    }
  }

  return {
    state,
    percent_received: qtyTotal > 0 ? Math.min(100, Math.round((qtyReceived / qtyTotal) * 100)) : 0,
    qty_total: qtyTotal,
    qty_received: qtyReceived,
    total_lines: items.length,
    open_lines: openLines,
    overdue: bucket === 'overdue',
    days_late: daysLate,
    bucket,
  };
}
