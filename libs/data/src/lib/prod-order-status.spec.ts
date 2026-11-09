import { summariseProdOrder } from './prod-order-status';

const TODAY = '2026-10-23';

// lines are [qty, complete, remaining]
const order = (due: string, lines: Array<[number, number, number]>) => ({
  expected_due_date: due,
  items: lines.map(([qty, qty_received, qty_remaining]) => ({ qty, qty_received, qty_remaining })),
});

describe('summariseProdOrder', () => {
  it('is Not started when nothing has been completed', () => {
    const s = summariseProdOrder(order('2026-11-05', [[5, 0, 5]]), TODAY);
    expect(s.state).toBe('Not started');
    expect(s.percent_complete).toBe(0);
    expect(s.overdue).toBe(false);
  });

  it('is In progress, with a percentage, once some quantity is completed', () => {
    const s = summariseProdOrder(order('2026-11-05', [[10, 4, 6]]), TODAY);
    expect(s.state).toBe('In progress');
    expect(s.percent_complete).toBe(40);
    expect(s.qty_complete).toBe(4);
    expect(s.qty_total).toBe(10);
  });

  it('is Completed, and never overdue, when nothing remains to be made', () => {
    const s = summariseProdOrder(order('2026-10-01', [[10, 10, 0]]), TODAY);
    expect(s.state).toBe('Completed');
    expect(s.percent_complete).toBe(100);
    expect(s.overdue).toBe(false);
    expect(s.days_late).toBe(0);
  });

  it('flags unfinished orders past their due date as overdue and counts the days late', () => {
    const s = summariseProdOrder(order('2026-10-20', [[10, 4, 6]]), TODAY);
    expect(s.overdue).toBe(true);
    expect(s.days_late).toBe(3);
  });

  it('does not mark an order due today as overdue', () => {
    expect(summariseProdOrder(order('2026-10-23', [[5, 0, 5]]), TODAY).overdue).toBe(false);
  });

  it('handles an order with no lines or no due date without throwing', () => {
    const empty = summariseProdOrder({ items: [] }, TODAY);
    expect(empty.state).toBe('Not started');
    expect(empty.percent_complete).toBe(0);
    expect(empty.overdue).toBe(false);
  });
});
