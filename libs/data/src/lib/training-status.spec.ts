import { addYears, cleanAreas, moduleStatus, overallState, summariseTraining } from './training-status';
import { TRAINING_MODULES, TRAINING_REQUIREMENTS } from './training-catalogue';

const TODAY = '2026-11-03';

describe('addYears', () => {
  it('adds whole years and keeps the day', () => {
    expect(addYears('2024-11-03', 2)).toBe('2026-11-03');
    expect(addYears('2023-01-31', 2)).toBe('2025-01-31');
  });

  it('moves 29 February to 28 February when the later year has no 29th', () => {
    expect(addYears('2024-02-29', 2)).toBe('2026-02-28');
    // ...but keeps it when the later year is a leap year
    expect(addYears('2020-02-29', 4)).toBe('2024-02-29');
  });
});

describe('moduleStatus', () => {
  it('is missing when the module was never completed', () => {
    for (const none of [null, undefined, '', 'not a date']) {
      expect(moduleStatus(none as any, TODAY)).toEqual({ state: 'missing', completedOn: null, renewsOn: null, daysLeft: null });
    }
  });

  it('is valid well before the renewal date, with the renewal two years after completion', () => {
    const s = moduleStatus('2026-05-01', TODAY);
    expect(s).toEqual({ state: 'valid', completedOn: '2026-05-01', renewsOn: '2028-05-01', daysLeft: 545 });
  });

  it('draws the lines at 61, 60, 0 and -1 days', () => {
    // A module renews exactly 2 years after completion, so pick completion dates that renew at those offsets from today.
    const completedFor = (daysLeft: number) => {
      const renews = new Date(Date.UTC(2026, 10, 3 + daysLeft)).toISOString().slice(0, 10);
      return addYears(renews, -2);
    };
    expect(moduleStatus(completedFor(61), TODAY)).toEqual(expect.objectContaining({ state: 'valid', daysLeft: 61 }));
    expect(moduleStatus(completedFor(60), TODAY)).toEqual(expect.objectContaining({ state: 'due-soon', daysLeft: 60 }));
    // On the renewal date itself it is still in date (due today).
    expect(moduleStatus(completedFor(0), TODAY)).toEqual(expect.objectContaining({ state: 'due-soon', daysLeft: 0 }));
    expect(moduleStatus(completedFor(-1), TODAY)).toEqual(expect.objectContaining({ state: 'expired', daysLeft: -1 }));
    expect(moduleStatus(completedFor(-400), TODAY).state).toBe('expired');
  });

  it('accepts a full time stamp or a Date', () => {
    expect(moduleStatus('2026-05-01T10:15:00.000Z', TODAY).completedOn).toBe('2026-05-01');
    expect(moduleStatus(new Date(2026, 4, 1), TODAY).completedOn).toBe('2026-05-01');
  });

  it('does not call a completion in the future expired', () => {
    expect(moduleStatus('2027-01-01', TODAY).state).toBe('valid');
  });
});

describe('summariseTraining', () => {
  const done = (modules: string[], date: string) => modules.map(module => ({ module, date }));

  it('requires nothing of a person with no roles, but still lists anything they have done', () => {
    const s = summariseTraining([], done(['Logistics'], '2026-01-01'), TODAY);
    expect(s.state).toBe('none');
    expect(s.counts.required).toBe(0);
    expect(s.areas).toEqual([]);
    expect(s.other.map(r => r.module)).toEqual(['Logistics']);
    expect(s.percentCurrent).toBe(0);
  });

  it('requires every module of a role, and counts the missing ones', () => {
    const s = summariseTraining(['warehouse'], done(['Warehouse Safety Induction'], '2026-06-01'), TODAY);
    expect(s.areas.length).toBe(1);
    expect(s.areas[0].modules.map(m => m.module)).toEqual(TRAINING_REQUIREMENTS.warehouse);
    expect(s.counts).toEqual({ required: 6, valid: 1, dueSoon: 0, expired: 0, missing: 5 });
    expect(s.state).toBe('attention');
    expect(s.percentCurrent).toBe(17);
  });

  it('is current when everything is in date, due soon when something is about to renew, attention when expired', () => {
    const all = TRAINING_REQUIREMENTS.warehouse;
    expect(summariseTraining(['warehouse'], done(all, '2026-06-01'), TODAY).state).toBe('current');
    const soon = done(all.slice(1), '2026-06-01').concat({ module: all[0], date: '2024-12-01' });   // renews 2026-12-01
    expect(summariseTraining(['warehouse'], soon, TODAY).state).toBe('due-soon');
    const old = done(all.slice(1), '2026-06-01').concat({ module: all[0], date: '2024-01-01' });    // renewed 2026-01-01
    const s = summariseTraining(['warehouse'], old, TODAY);
    expect(s.state).toBe('attention');
    expect(s.counts.expired).toBe(1);
  });

  it('adds up several roles, counting a module needed by two of them once', () => {
    const s = summariseTraining(['warehouse', 'config', 'fat'], [], TODAY);
    const unique = new Set([...TRAINING_REQUIREMENTS.warehouse, ...TRAINING_REQUIREMENTS.config, ...TRAINING_REQUIREMENTS.fat]);
    expect(s.counts.required).toBe(unique.size);
    expect(s.counts.missing).toBe(unique.size);
    expect(s.areas.map(a => a.area)).toEqual(['warehouse', 'config', 'fat']);
  });

  it('uses the newest completion when a module has been done more than once', () => {
    const s = summariseTraining(['warehouse'], [
      { module: 'Stock Management', date: '2020-01-01' },
      { module: 'Stock Management', date: '2026-09-01' },
      { module: 'Stock Management', date: '2022-01-01' },
    ], TODAY);
    expect(s.areas[0].modules.find(m => m.module === 'Stock Management').status.completedOn).toBe('2026-09-01');
  });

  it('keeps training that no held role requires apart, with its own status', () => {
    const s = summariseTraining(['warehouse'], [{ module: 'Conveyors', date: '2020-01-01' }], TODAY);
    expect(s.other).toEqual([expect.objectContaining({ module: 'Conveyors', category: 'Assembly' })]);
    expect(s.other[0].status.state).toBe('expired');
    // It is not counted against the person: it is not required.
    expect(s.counts.expired).toBe(0);
  });

  it('ignores unknown roles and malformed records', () => {
    const s = summariseTraining(['warehouse', 'bogus'] as any, [{ module: '', date: '2026-01-01' }, { module: 'Stock Management', date: 'x' }] as any, TODAY);
    expect(s.areas.length).toBe(1);
    expect(s.counts.missing).toBe(6);
    expect(summariseTraining(null, null, TODAY).state).toBe('none');
  });
});

describe('overallState and cleanAreas', () => {
  it('ranks attention over due soon over current', () => {
    expect(overallState({ required: 0, valid: 0, dueSoon: 0, expired: 0, missing: 0 })).toBe('none');
    expect(overallState({ required: 3, valid: 3, dueSoon: 0, expired: 0, missing: 0 })).toBe('current');
    expect(overallState({ required: 3, valid: 2, dueSoon: 1, expired: 0, missing: 0 })).toBe('due-soon');
    expect(overallState({ required: 3, valid: 1, dueSoon: 1, expired: 0, missing: 1 })).toBe('attention');
  });

  it('keeps only real roles, once each, in the usual order', () => {
    expect(cleanAreas(['fat', 'warehouse', 'fat', 'admin', 3])).toEqual(['warehouse', 'fat']);
    expect(cleanAreas('warehouse')).toEqual([]);
    expect(cleanAreas(undefined)).toEqual([]);
  });
});

describe('the catalogue', () => {
  it('lists each module once', () => {
    const names = TRAINING_MODULES.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only requires modules that exist, and no role lists one twice', () => {
    const names = new Set(TRAINING_MODULES.map(m => m.name));
    Object.keys(TRAINING_REQUIREMENTS).forEach(area => {
      const list = TRAINING_REQUIREMENTS[area];
      expect(new Set(list).size).toBe(list.length);
      list.forEach(m => expect(names.has(m)).toBe(true));
    });
  });
});
