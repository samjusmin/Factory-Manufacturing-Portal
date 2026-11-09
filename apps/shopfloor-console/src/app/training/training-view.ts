import {
  IModuleStatus,
  ITrainingCounts,
  ITrainingLocation,
  ITrainingUserRow,
  TrainingOverall,
  TrainingState,
} from '@webproject/data';

// How the Training pages word and total things. Kept apart from the components so the figures on the cards, the
// tiles and the rows are worked out one way and can be tested without a screen.

export const STATE_LABELS: { [state in TrainingState]: string } = {
  'valid': 'In date',
  'due-soon': 'Due soon',
  'expired': 'Expired',
  'missing': 'Not done',
};

export const OVERALL_LABELS: { [state in TrainingOverall]: string } = {
  'none': 'No role',
  'current': 'Up to date',
  'due-soon': 'Due soon',
  'attention': 'Needs attention',
};

// What a person is, as shown under their name: the same wording as the badge on Home.
const ROLE_LABELS: { [role: string]: string } = { ADMIN: 'Administrator', OPERATOR: 'Operator', EXTUSER: 'External user' };

export function roleLabel(roles: string[] | null | undefined): string {
  const known = (roles || []).map(r => ROLE_LABELS[String(r).toUpperCase()]).filter(l => l);
  return known.length ? known.join(', ') : 'No sign-in role';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-11-03' -> '3 Nov 2026'. Anything else is shown as a dash.
export function formatDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : '–';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The line under a module's status: how long it has left, or how long ago it ran out.
export function timeLeftText(status: IModuleStatus): string {
  if (status.daysLeft === null) {
    return 'Never completed';
  }
  if (status.daysLeft < 0) {
    return `Expired ${plural(-status.daysLeft, 'day')} ago`;
  }
  return status.daysLeft === 0 ? 'Renews today' : `Renews in ${plural(status.daysLeft, 'day')}`;
}

export const emptyCounts = (): ITrainingCounts => ({ required: 0, valid: 0, dueSoon: 0, expired: 0, missing: 0 });

export function addCounts(a: ITrainingCounts, b: ITrainingCounts): ITrainingCounts {
  return {
    required: a.required + b.required,
    valid: a.valid + b.valid,
    dueSoon: a.dueSoon + b.dueSoon,
    expired: a.expired + b.expired,
    missing: a.missing + b.missing,
  };
}

// Modules that are out of date or never done: the ones shown in red.
export const redCount = (counts: ITrainingCounts) => counts.expired + counts.missing;

// People in each overall state.
export interface IPeopleTotals {
  people: number;
  attention: number;
  dueSoon: number;
  current: number;
  noRole: number;
}

export function peopleTotals(users: ITrainingUserRow[]): IPeopleTotals {
  const count = (state: TrainingOverall) => users.filter(u => u.state === state).length;
  return {
    people: users.length,
    attention: count('attention'),
    dueSoon: count('due-soon'),
    current: count('current'),
    noRole: count('none'),
  };
}

// One card on the locations page.
export interface ILocationCard {
  location: string;
  users: ITrainingUserRow[];
  totals: IPeopleTotals;
  counts: ITrainingCounts;
  // Widths (0-100) of the bar of required modules: in date, due soon, and out of date or not done.
  bar: { valid: number, dueSoon: number, red: number };
}

export function locationCard(entry: ITrainingLocation): ILocationCard {
  const counts = entry.users.reduce((sum, u) => addCounts(sum, u.counts), emptyCounts());
  const share = (n: number) => (counts.required ? (n / counts.required) * 100 : 0);
  return {
    location: entry.location,
    users: entry.users,
    totals: peopleTotals(entry.users),
    counts,
    bar: { valid: share(counts.valid), dueSoon: share(counts.dueSoon), red: share(redCount(counts)) },
  };
}

// Everyone across every location, each person once (a person registered at two locations is listed under both).
export function distinctPeople(locations: ITrainingLocation[]): ITrainingUserRow[] {
  const seen = new Map<string, ITrainingUserRow>();
  locations.forEach(l => l.users.forEach(u => seen.set(u.username, u)));
  return Array.from(seen.values());
}
