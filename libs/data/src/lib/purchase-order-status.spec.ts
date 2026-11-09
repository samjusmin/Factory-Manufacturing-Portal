import { localIsoDate, summarisePurchaseOrder } from './purchase-order-status';

const TODAY = '2026-10-23';

// lines are [qty, received, remaining]
const po = (status: string, due: string, lines: Array<[number, number, number]>) => ({
  status,
  expected_due_date: due,
  items: lines.map(([qty, qty_received, qty_remaining]) => ({ qty, qty_received, qty_remaining })),
});

describe('summarisePurchaseOrder', () => {
  it('treats anything not released as an open (draft) order with no due-date bucket', () => {
    const s = summarisePurchaseOrder(po('Open', '2026-10-20', [[5, 0, 5]]), TODAY);
    expect(s.state).toBe('Open');
    expect(s.bucket).toBeNull();
    expect(s.overdue).toBe(false);
  });

  it('is On order when released and nothing has arrived', () => {
    const s = summarisePurchaseOrder(po('Released', '2026-11-30', [[10, 0, 10], [5, 0, 5]]), TODAY);
    expect(s.state).toBe('On order');
    expect(s.percent_received).toBe(0);
    expect(s.open_lines).toBe(2);
    expect(s.total_lines).toBe(2);
  });

  it('is Partially received once any quantity has arrived', () => {
    const s = summarisePurchaseOrder(po('Released', '2026-10-30', [[10, 4, 6], [10, 10, 0]]), TODAY);
    expect(s.state).toBe('Partially received');
    expect(s.percent_received).toBe(70);
    expect(s.open_lines).toBe(1);
  });

  it('is Received, with no bucket, when every line has nothing remaining', () => {
    const s = summarisePurchaseOrder(po('Released', '2026-10-01', [[10, 10, 0], [4, 4, 0]]), TODAY);
    expect(s.state).toBe('Received');
    expect(s.percent_received).toBe(100);
    expect(s.open_lines).toBe(0);
    expect(s.bucket).toBeNull();
    expect(s.overdue).toBe(false);
  });

  it('flags released orders past their due date as overdue and counts the days late', () => {
    const s = summarisePurchaseOrder(po('Released', '2026-10-18', [[10, 0, 10]]), TODAY);
    expect(s.bucket).toBe('overdue');
    expect(s.overdue).toBe(true);
    expect(s.days_late).toBe(5);
  });

  it('puts orders due today up to 7 days out in this-week, and later ones in later', () => {
    expect(summarisePurchaseOrder(po('Released', '2026-10-23', [[1, 0, 1]]), TODAY).bucket).toBe('this-week');
    expect(summarisePurchaseOrder(po('Released', '2026-10-30', [[1, 0, 1]]), TODAY).bucket).toBe('this-week');
    expect(summarisePurchaseOrder(po('Released', '2026-10-31', [[1, 0, 1]]), TODAY).bucket).toBe('later');
  });

  it('handles an order with no lines, no due date or zero quantities without throwing', () => {
    const empty = summarisePurchaseOrder({ status: 'Released', items: [] }, TODAY);
    expect(empty.state).toBe('On order');
    expect(empty.percent_received).toBe(0);
    expect(empty.bucket).toBeNull();

    const zero = summarisePurchaseOrder(po('Released', '2026-11-01', [[0, 0, 0]]), TODAY);
    expect(zero.percent_received).toBe(0);
    expect(zero.state).toBe('Received');
  });
});

describe('localIsoDate', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localIsoDate(new Date(2026, 9, 23))).toBe('2026-10-23');
  });
});
