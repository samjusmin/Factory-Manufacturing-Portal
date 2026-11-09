import { fatCheckCounts, summariseFatChecks } from './fat-checks';

const categories = [
  {
    name: 'Kiosk Common',
    checklists: [
      { description: 'Section', reference: 'Heading', status: null },
      { description: 'Label fitted', status: 'Complete' },
      { description: 'Latch', status: 'Incomplete', comment: 'Sticks' },
      { description: 'Printer', status: 'N/A' },
      { description: 'Cables', status: null },
    ],
  },
  {
    name: 'Bios',
    checklists: [
      { description: 'Version', status: 'Incomplete' },
      { description: 'Boot order' },
    ],
  },
];

describe('summariseFatChecks', () => {
  it('counts each kind of check and ignores section headings', () => {
    const s = summariseFatChecks(categories);
    expect(s.total).toBe(6);
    expect(s.complete).toBe(1);
    expect(s.notApplicable).toBe(1);
    expect(s.failed).toBe(2);
    expect(s.unanswered).toBe(2);
    expect(s.outstanding).toBe(4);
  });

  it('lists failed checks first, then unanswered ones, with their category and note', () => {
    const s = summariseFatChecks(categories);
    expect(s.items.map(i => [i.category, i.description, i.status])).toEqual([
      ['Kiosk Common', 'Latch', 'Incomplete'],
      ['Bios', 'Version', 'Incomplete'],
      ['Kiosk Common', 'Cables', null],
      ['Bios', 'Boot order', null],
    ]);
    expect(s.items[0].comment).toBe('Sticks');
    expect(s.items[1].comment).toBeNull();
  });

  it('has nothing outstanding when every check is complete or not applicable', () => {
    const s = summariseFatChecks([{ name: 'A', checklists: [{ description: 'x', status: 'Complete' }, { description: 'y', status: 'N/A' }] }]);
    expect(s.outstanding).toBe(0);
    expect(s.items).toEqual([]);
  });

  it('copes with no categories or categories with no checks', () => {
    expect(summariseFatChecks(null).total).toBe(0);
    expect(summariseFatChecks([{ name: 'Empty' }]).outstanding).toBe(0);
  });

  it('gives the counts without the list', () => {
    const counts = fatCheckCounts(summariseFatChecks(categories));
    expect(counts).toEqual({ total: 6, complete: 1, notApplicable: 1, failed: 2, unanswered: 2, outstanding: 4 });
    expect((counts as any).items).toBeUndefined();
  });
});
