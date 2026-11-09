import { BadRequestException, ConflictException } from '@nestjs/common';
import { newUnitNumbers, stampChecks } from './fat-check-rules';

const stored = () => [
  { description: 'Section', reference: 'Heading', status: null, comment: null, checked_by: null, date_checked: null, second_checker: null },
  { description: 'A', reference: null, status: 'Complete', comment: 'ok', checked_by: 'Alex', date_checked: '2026-01-01', second_checker: null },
  { description: 'B', reference: null, status: null, comment: null, checked_by: null, date_checked: null, second_checker: null },
];

describe('stampChecks', () => {
  it('stamps a changed row with the signed-in person, whatever the request says', () => {
    const sent = stored();
    sent[2] = { ...sent[2], status: 'Complete', checked_by: 'FORGED', date_checked: '2001-01-01' };
    const rows = stampChecks(stored(), sent, 'Sam', '2026-11-05T00:00:00Z');
    expect(rows[2].status).toBe('Complete');
    expect(rows[2].checked_by).toBe('Sam');
    expect(rows[2].date_checked).toBe('2026-11-05T00:00:00Z');
  });

  it('keeps the stamp of a row whose answers did not change, even if the request changes the stamp', () => {
    const sent = stored();
    sent[1] = { ...sent[1], checked_by: 'FORGED', date_checked: '2001-01-01' };
    const rows = stampChecks(stored(), sent, 'Sam', 'now');
    expect(rows[1].checked_by).toBe('Alex');
    expect(rows[1].date_checked).toBe('2026-01-01');
  });

  it('removes the stamp when an answer is taken back', () => {
    const sent = stored();
    sent[1] = { ...sent[1], status: null };
    const rows = stampChecks(stored(), sent, 'Sam', 'now');
    expect(rows[1].checked_by).toBeNull();
    expect(rows[1].date_checked).toBeNull();
  });

  it('never takes the wording of a check, or answers on a heading, from the request', () => {
    const sent = stored();
    sent[0] = { ...sent[0], status: 'Complete' };
    sent[2] = { ...sent[2], status: 'Complete', reference: 'CHANGED' } as any;
    const rows = stampChecks(stored(), sent, 'Sam', 'now');
    expect(rows[0].status).toBeNull();
    expect(rows[2].reference).toBeNull();
  });

  it('treats a different number of rows, or different checks, as someone else having changed the list', () => {
    expect(() => stampChecks(stored(), stored().slice(0, 1), 'Sam', 'now')).toThrow(ConflictException);
    const renamed = stored();
    renamed[1] = { ...renamed[1], description: 'WIPED' };
    expect(() => stampChecks(stored(), renamed, 'Sam', 'now')).toThrow(ConflictException);
  });

  it('refuses an answer that is not one of the three', () => {
    const sent = stored();
    sent[2] = { ...sent[2], status: 'Done' };
    expect(() => stampChecks(stored(), sent, 'Sam', 'now')).toThrow(BadRequestException);
  });
});

describe('newUnitNumbers', () => {
  it('lists each number each entry would create', () => {
    expect(newUnitNumbers([{ prefix: 'UZ', start: 1001, number: 2 }, { prefix: 'KA', start: 5, number: 1 }])).toEqual(['UZ1001', 'UZ1002', 'KA5']);
  });
});
