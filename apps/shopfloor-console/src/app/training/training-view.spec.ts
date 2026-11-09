import { ITrainingCounts, ITrainingUserRow } from '@webproject/data';
import { distinctPeople, emptyCounts, formatDate, locationCard, peopleTotals, redCount, roleLabel, timeLeftText } from './training-view';

const counts = (required: number, valid: number, dueSoon: number, expired: number, missing: number): ITrainingCounts =>
  ({ required, valid, dueSoon, expired, missing });

const person = (username: string, state: any, c: ITrainingCounts): ITrainingUserRow =>
  ({ username, name: username, roles: ['OPERATOR'], areas: ['warehouse'], counts: c, state, percentCurrent: 0 });

describe('training view helpers', () => {
  it('formats a date and shows a dash for anything else', () => {
    expect(formatDate('2026-11-03')).toBe('3 Nov 2026');
    expect(formatDate('2028-02-29')).toBe('29 Feb 2028');
    for (const bad of [null, undefined, '', 'soon', '2026-11-03T10:00:00Z']) {
      expect(formatDate(bad as any)).toBe('–');
    }
  });

  it('says how long a module has left', () => {
    const at = (daysLeft: number | null) => timeLeftText({ state: 'valid', completedOn: null, renewsOn: null, daysLeft });
    expect(at(null)).toBe('Never completed');
    expect(at(-1)).toBe('Expired 1 day ago');
    expect(at(-70)).toBe('Expired 70 days ago');
    expect(at(0)).toBe('Renews today');
    expect(at(1)).toBe('Renews in 1 day');
    expect(at(40)).toBe('Renews in 40 days');
  });

  it('labels a person by their sign-in role', () => {
    expect(roleLabel(['ADMIN'])).toBe('Administrator');
    expect(roleLabel(['OPERATOR'])).toBe('Operator');
    expect(roleLabel(['EXTUSER'])).toBe('External user');
    expect(roleLabel(['operator'])).toBe('Operator');
    expect(roleLabel(['ADMIN', 'OPERATOR'])).toBe('Administrator, Operator');
    for (const none of [[], undefined, null, ['SOMETHING']]) {
      expect(roleLabel(none as any)).toBe('No sign-in role');
    }
  });

  it('counts the red modules as expired plus not done', () => {
    expect(redCount(counts(10, 5, 1, 3, 1))).toBe(4);
    expect(redCount(emptyCounts())).toBe(0);
  });

  it('counts people in each state', () => {
    const totals = peopleTotals([
      person('a', 'attention', emptyCounts()), person('b', 'attention', emptyCounts()),
      person('c', 'due-soon', emptyCounts()), person('d', 'current', emptyCounts()), person('e', 'none', emptyCounts()),
    ]);
    expect(totals).toEqual({ people: 5, attention: 2, dueSoon: 1, current: 1, noRole: 1 });
  });

  describe('locationCard', () => {
    it('adds up the modules of everyone at the location and sizes the bar from them', () => {
      const card = locationCard({
        location: 'Meridian HQ',
        users: [person('a', 'attention', counts(6, 3, 1, 1, 1)), person('b', 'current', counts(4, 4, 0, 0, 0))],
      });
      expect(card.counts).toEqual(counts(10, 7, 1, 1, 1));
      expect(card.bar).toEqual({ valid: 70, dueSoon: 10, red: 20 });
      expect(card.totals.attention).toBe(1);
    });

    it('has an empty bar when nobody at the location has a role', () => {
      const card = locationCard({ location: 'Empty Site', users: [] });
      expect(card.bar).toEqual({ valid: 0, dueSoon: 0, red: 0 });
      expect(card.totals.people).toBe(0);
    });
  });

  it('lists a person who is registered at two locations once', () => {
    const ravi = person('ravi', 'attention', emptyCounts());
    const people = distinctPeople([
      { location: 'Partner A', users: [ravi, person('chloe', 'current', emptyCounts())] },
      { location: 'Partner B', users: [ravi] },
    ]);
    expect(people.map(p => p.username).sort()).toEqual(['chloe', 'ravi']);
  });
});
