// How healthy is the stock of one item? Shared by the Inventory list, its filter buttons and the Home card
// so the three always agree. Mirrors the rule the dashboard counts use: low = at or below the reorder point.

export type StockState = 'In stock' | 'Low stock' | 'Out of stock';

export interface IStockSummary {
  state: StockState;
  // Stock as a share of the full level (reorder point + reorder quantity), 0-100, for the level bar.
  percent_full: number;
  // Where the reorder point sits on that bar, 0-100, or null when the item has none.
  reorder_marker: number | null;
  // How many units are needed to get back above the reorder point (0 when stock is fine).
  shortfall: number;
}

interface StockLike {
  inventory?: number;
  reorder_point?: number | null;
  reorder_qty?: number | null;
}

export function summariseStock(item: StockLike): IStockSummary {
  const onHand = item.inventory || 0;
  const hasPoint = typeof item.reorder_point === 'number';
  const point = hasPoint ? (item.reorder_point as number) : 0;
  const full = point + (item.reorder_qty || 0);

  let state: StockState = 'In stock';
  if (onHand <= 0) {
    state = 'Out of stock';
  } else if (hasPoint && onHand <= point) {
    state = 'Low stock';
  }

  const scale = full > 0 ? full : Math.max(onHand, 1);
  return {
    state,
    percent_full: Math.max(0, Math.min(100, Math.round((onHand / scale) * 100))),
    reorder_marker: hasPoint && full > 0 ? Math.min(100, Math.round((point / full) * 100)) : null,
    shortfall: state === 'In stock' ? 0 : Math.max(0, point + 1 - onHand),
  };
}
