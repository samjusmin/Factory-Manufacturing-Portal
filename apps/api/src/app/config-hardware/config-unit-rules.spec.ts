import { BadRequestException } from '@nestjs/common';
import { applyChanges, escapeRegExp, resolveModel, resolveParts, serialMatcher } from './config-unit-rules';

const checklist = () => [
  { description: 'Section', reference: 'Heading' },
  { description: 'One', reference: null, status: null, checked_by: null, date_checked: null, comment: null },
  { description: 'Two', reference: 'R', status: 'Complete', checked_by: 'Alex', date_checked: '2026-01-01', comment: 'ok' },
];

describe('serial matching', () => {
  it('matches the whole serial whatever its letter case', () => {
    expect(serialMatcher(' dl7000-a1 ').test('DL7000-A1')).toBe(true);
    expect(serialMatcher('DL7000-A1').test('DL7000-A10')).toBe(false);
    expect(serialMatcher('A.B').test('AxB')).toBe(false);
    expect(escapeRegExp('a+b(c)')).toBe('a\\+b\\(c\\)');
  });
});

describe('applyChanges', () => {
  it('leaves the checklist alone when nothing changed', () => {
    expect(applyChanges(checklist(), undefined, 'Sam', 'now')).toEqual(checklist());
    expect(applyChanges(checklist(), [], 'Sam', 'now')).toEqual(checklist());
  });

  it('stamps an answered check with who and when, without touching the others', () => {
    const rows = applyChanges(checklist(), [{ index: 1, status: 'Complete', comment: 'fine' }], 'Sam', '2026-11-03');
    expect(rows[1]).toMatchObject({ status: 'Complete', comment: 'fine', checked_by: 'Sam', date_checked: '2026-11-03' });
    expect(rows[2]).toMatchObject({ status: 'Complete', checked_by: 'Alex', date_checked: '2026-01-01' });
  });

  it('clears the stamp when an answer is taken back', () => {
    const rows = applyChanges(checklist(), [{ index: 2, status: null, comment: '' }], 'Sam', 'now');
    expect(rows[2]).toMatchObject({ status: null, comment: null, checked_by: null, date_checked: null });
  });

  it('does not change the list it was given', () => {
    const original = checklist();
    applyChanges(original, [{ index: 1, status: 'N/A' }], 'Sam', 'now');
    expect(original[1].status).toBeNull();
  });

  it('refuses a check that is not there, a heading, or an answer that does not exist', () => {
    expect(() => applyChanges(checklist(), [{ index: 9, status: 'Complete' }], 'Sam', 'now')).toThrow(BadRequestException);
    expect(() => applyChanges(checklist(), [{ index: 'x' as any, status: 'Complete' }], 'Sam', 'now')).toThrow(BadRequestException);
    expect(() => applyChanges(checklist(), [{ index: 0, status: 'Complete' }], 'Sam', 'now')).toThrow('heading');
    expect(() => applyChanges(checklist(), [{ index: 1, status: 'Maybe' }], 'Sam', 'now')).toThrow('Complete, Incomplete or N/A');
    expect(() => applyChanges(checklist(), 'nope', 'Sam', 'now')).toThrow(BadRequestException);
  });
});

describe('resolveParts', () => {
  it('has no parts when the category defines none', () => {
    expect(resolveParts([], [{ name: 'X', serial_no: '1' }], 'S')).toEqual([]);
  });

  it('gives each defined part the serial it was sent, blank when none', () => {
    expect(resolveParts(['Unit W1-1', 'Unit W1-2'], [{ name: 'Unit W1-2', serial_no: ' B2 ' }, { name: 'Other', serial_no: 'Z' }], 'SET-1'))
      .toEqual([{ name: 'Unit W1-1', serial_no: '' }, { name: 'Unit W1-2', serial_no: 'B2' }]);
    expect(resolveParts(['A'], undefined, 'S')).toEqual([{ name: 'A', serial_no: '' }]);
  });

  it('refuses a part serial that repeats the unit\'s or another part\'s', () => {
    expect(() => resolveParts(['A'], [{ name: 'A', serial_no: 'set-1' }], 'SET-1')).toThrow('same serial no.');
    expect(() => resolveParts(['A', 'B'], [{ name: 'A', serial_no: 'x1' }, { name: 'B', serial_no: 'X1' }], 'S')).toThrow('more than one part');
  });
});

describe('resolveModel', () => {
  it('fills in the only model available', () => {
    expect(resolveModel(['W1 Controller'], undefined, null, 'UNIT-W1', 'Meridian HQ')).toBe('W1 Controller');
    expect(resolveModel(['W1 Controller'], '  ', null, 'UNIT-W1', 'Meridian HQ')).toBe('W1 Controller');
  });

  it('makes the user choose when there are several', () => {
    expect(() => resolveModel(['A', 'B'], null, null, 'PC', 'HQ')).toThrow('Choose a model.');
    expect(resolveModel(['A', 'B'], 'B', null, 'PC', 'HQ')).toBe('B');
    expect(() => resolveModel(['A', 'B'], 'C', null, 'PC', 'HQ')).toThrow('not a PC model available at HQ');
  });

  it('has no model when none are set up, and refuses one that is named', () => {
    expect(resolveModel([], undefined, null, 'Printer', 'HQ')).toBeNull();
    expect(() => resolveModel([], 'X', null, 'Printer', 'HQ')).toThrow('no Printer models');
  });

  it('keeps a model the unit already has even if the location\'s list has changed', () => {
    expect(resolveModel(['A'], 'Old', 'Old', 'PC', 'HQ')).toBe('Old');
    expect(resolveModel([], 'Old', 'Old', 'PC', 'HQ')).toBe('Old');
  });
});
