import {
  STOCK_PROJECT,
  checkRows,
  checklistProgress,
  cleanProjectCode,
  cleanSerial,
  isCheckDone,
  locationProjects,
  sameSerial,
} from './config-catalogue';

describe('config catalogue helpers', () => {
  it('always lists STOCK first, then the location\'s projects once each', () => {
    expect(locationProjects(undefined)).toEqual(['STOCK']);
    expect(locationProjects([])).toEqual(['STOCK']);
    expect(locationProjects(['PRJ-B', 'prj-a', 'PRJ-B', 'stock', ' '])).toEqual(['STOCK', 'PRJ-B', 'PRJ-A']);
    expect(STOCK_PROJECT).toBe('STOCK');
  });

  it('writes project codes in upper case with single spaces', () => {
    expect(cleanProjectCode('  prj   alpha ')).toBe('PRJ ALPHA');
    expect(cleanProjectCode(null)).toBe('');
  });

  it('compares serial numbers without spaces or letter case', () => {
    expect(cleanSerial('  DL7000-A1  ')).toBe('DL7000-A1');
    expect(sameSerial('dl7000-a1', ' DL7000-A1 ')).toBe(true);
    expect(sameSerial('DL7000-A1', 'DL7000-A2')).toBe(false);
    expect(sameSerial('', null)).toBe(true);
  });

  it('does not count section headings as checks', () => {
    const rows = [{ reference: 'Heading', status: null }, { reference: null, status: null }, { status: 'Complete' }];
    expect(checkRows(rows).length).toBe(2);
    expect(checkRows(null)).toEqual([]);
  });

  it('counts Complete and N/A as done and Incomplete as not', () => {
    expect(isCheckDone({ status: 'Complete' })).toBe(true);
    expect(isCheckDone({ status: 'N/A' })).toBe(true);
    expect(isCheckDone({ status: 'Incomplete' })).toBe(false);
    expect(isCheckDone({ status: null })).toBe(false);
  });

  it('works out progress from the whole checklist', () => {
    const rows: any[] = [
      { reference: 'Heading', status: null },
      { status: 'Complete' }, { status: 'N/A' }, { status: 'Incomplete' }, { status: null },
    ];
    expect(checklistProgress(rows)).toBe(50);
    expect(checklistProgress(rows.map(r => ({ ...r, status: 'Complete' })))).toBe(100);
    expect(checklistProgress([])).toBe(0);
    expect(checklistProgress([{ reference: 'Heading' }])).toBe(0);
    expect(checklistProgress(undefined)).toBe(0);
  });
});
