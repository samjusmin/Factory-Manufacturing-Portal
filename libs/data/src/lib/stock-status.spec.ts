import { summariseStock } from './stock-status';

describe('summariseStock', () => {
  it('is In stock above the reorder point', () => {
    const s = summariseStock({ inventory: 42, reorder_point: 20, reorder_qty: 40 });
    expect(s.state).toBe('In stock');
    expect(s.shortfall).toBe(0);
    expect(s.percent_full).toBe(70);
    expect(s.reorder_marker).toBe(33);
  });

  it('is Low stock at or below the reorder point', () => {
    expect(summariseStock({ inventory: 2, reorder_point: 2, reorder_qty: 4 }).state).toBe('Low stock');
    const s = summariseStock({ inventory: 8, reorder_point: 15, reorder_qty: 30 });
    expect(s.state).toBe('Low stock');
    expect(s.shortfall).toBe(8);
  });

  it('is Out of stock at zero, even with no reorder point', () => {
    expect(summariseStock({ inventory: 0, reorder_point: 25, reorder_qty: 50 }).state).toBe('Out of stock');
    expect(summariseStock({ inventory: 0 }).state).toBe('Out of stock');
  });

  it('never reports low stock for an item without a reorder point, and caps the bar at 100', () => {
    const s = summariseStock({ inventory: 5 });
    expect(s.state).toBe('In stock');
    expect(s.reorder_marker).toBeNull();
    expect(summariseStock({ inventory: 500, reorder_point: 10, reorder_qty: 10 }).percent_full).toBe(100);
  });
});
