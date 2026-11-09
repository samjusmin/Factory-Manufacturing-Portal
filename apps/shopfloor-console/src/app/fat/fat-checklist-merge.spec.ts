import { checkSnapshot, mergeChecklist } from './fat-checklist-merge';

const row = (description: string, status: string | null = null, comment: string | null = null, extra: any = {}) =>
  ({ description, reference: '', status, comment, checked_by: null, date_checked: null, second_checker: null, ...extra } as any);

const snaps = (rows: any[]) => rows.map(checkSnapshot);

describe('checkSnapshot', () => {
  it('treats an empty value and a missing one as the same', () => {
    expect(checkSnapshot(row('a', null, ''))).toBe(checkSnapshot(row('a', null, null)));
    expect(checkSnapshot(row('a', 'Complete'))).not.toBe(checkSnapshot(row('a', null)));
  });
});

describe('mergeChecklist', () => {
  const base = [row('A'), row('B'), row('C'), row('D')];

  it('keeps a change only you made, and takes one only they made', () => {
    const mine = [row('A', 'Complete'), row('B'), row('C'), row('D')];
    const theirs = [row('A'), row('B', 'Incomplete', 'bad', { checked_by: 'Sam' }), row('C'), row('D')];
    const merged = mergeChecklist(snaps(base), mine, theirs);
    expect(merged.rows.map(r => r.status)).toEqual(['Complete', 'Incomplete', null, null]);
    expect(merged.rows[1].checked_by).toBe('Sam');
    expect(merged.fromOthers).toBe(1);
    expect(merged.yours).toBe(1);
    expect(merged.conflicts).toEqual([]);
  });

  it('is not a conflict when you both made the same change', () => {
    const mine = [row('A', 'Complete'), row('B'), row('C'), row('D')];
    const theirs = [row('A', 'Complete', null, { checked_by: 'Sam' }), row('B'), row('C'), row('D')];
    const merged = mergeChecklist(snaps(base), mine, theirs);
    expect(merged.conflicts).toEqual([]);
    // The server's row is shown, so it has the right checker.
    expect(merged.rows[0].checked_by).toBe('Sam');
    expect(merged.yours).toBe(0);
    expect(merged.fromOthers).toBe(0);
  });

  it('reports a row you both changed to different things, starting from your version', () => {
    const mine = [row('A', 'Complete'), row('B'), row('C'), row('D')];
    const theirs = [row('A', 'Incomplete'), row('B'), row('C'), row('D')];
    const merged = mergeChecklist(snaps(base), mine, theirs);
    expect(merged.conflicts.length).toBe(1);
    expect(merged.conflicts[0].index).toBe(0);
    expect(merged.conflicts[0].description).toBe('A');
    expect(merged.conflicts[0].mine.status).toBe('Complete');
    expect(merged.conflicts[0].theirs.status).toBe('Incomplete');
    expect(merged.rows[0]).toBe(mine[0]);
  });

  it('counts a changed note or second checker as a change', () => {
    const mine = [row('A', null, 'my note'), row('B'), row('C'), row('D')];
    const theirs = [row('A', null, 'their note'), row('B'), row('C'), row('D')];
    expect(mergeChecklist(snaps(base), mine, theirs).conflicts.length).toBe(1);
  });

  it('leaves section headings alone', () => {
    const heading = row('Section', null, null, { reference: 'Heading' });
    const merged = mergeChecklist(snaps([heading, row('A')]), [heading, row('A', 'Complete')], [heading, row('A')]);
    expect(merged.rows[0]).toBe(heading);
    expect(merged.yours).toBe(1);
  });

  it('gives up when the checklist no longer has the same rows', () => {
    expect(mergeChecklist(snaps(base), base, base.slice(0, 3))).toBeNull();
    expect(mergeChecklist(snaps(base).slice(1), base, base)).toBeNull();
  });
});
