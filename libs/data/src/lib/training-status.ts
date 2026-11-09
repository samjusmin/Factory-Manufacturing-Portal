// Where does a person's training stand? Pure functions shared by the API (which sends the summaries and counts them
// for the Home card) and the app (which shows them), so every figure agrees.
//
// A module is valid for TRAINING_VALIDITY_YEARS from the day it was completed. The "renewal date" is that day; it is
// worked out here and never stored, so it cannot drift from the completion date.
//
//   valid     completed, and the renewal date is more than DUE_SOON_DAYS away
//   due-soon  completed, and renewal is within DUE_SOON_DAYS (still in date, shown amber)
//   expired   completed, but the renewal date has passed (shown red)
//   missing   never completed (shown red)

import { localIsoDate } from './purchase-order-status';
import {
  TRAINING_AREAS,
  TRAINING_DUE_SOON_DAYS,
  TRAINING_REQUIREMENTS,
  TRAINING_VALIDITY_YEARS,
  TrainingArea,
  isTrainingArea,
  trainingModuleInfo,
} from './training-catalogue';

export type TrainingState = 'valid' | 'due-soon' | 'expired' | 'missing';

export interface IModuleStatus {
  state: TrainingState;
  // YYYY-MM-DD, or null when the module was never completed.
  completedOn: string | null;
  renewsOn: string | null;
  // Days until the renewal date (negative once it has passed); null when never completed.
  daysLeft: number | null;
}

export interface ITrainingCompletion {
  module: string;
  // YYYY-MM-DD (a full ISO time stamp is accepted and its date used).
  date: string | Date;
}

export interface ITrainingModuleRow {
  module: string;
  category: string;
  status: IModuleStatus;
}

export interface ITrainingCounts {
  // Modules that are needed (each counted once, even when two roles both need it).
  required: number;
  valid: number;
  dueSoon: number;
  expired: number;
  missing: number;
}

// 'none': the person holds no role, so nothing is required. 'attention': something is expired or missing.
export type TrainingOverall = 'none' | 'current' | 'due-soon' | 'attention';

export interface IAreaTraining {
  area: TrainingArea;
  modules: ITrainingModuleRow[];
  counts: ITrainingCounts;
}

export interface ITrainingSummary {
  areas: IAreaTraining[];
  // Training completed that none of the person's roles require.
  other: ITrainingModuleRow[];
  counts: ITrainingCounts;
  state: TrainingOverall;
  // Share of the required modules that are in date (valid or due soon), 0 to 100.
  percentCurrent: number;
}

// ---------- dates ----------

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : localIsoDate(value);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? match[1] + '-' + match[2] + '-' + match[3] : null;
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;

// The same day N years later. 29 February moves to 28 February in a year that has no 29th.
export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const year = y + years;
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return year + '-' + pad(m) + '-' + pad(Math.min(d, lastDay));
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

// ---------- one module ----------

export function moduleStatus(completedOn: string | Date | null | undefined, today: string = localIsoDate()): IModuleStatus {
  const completed = toIsoDate(completedOn);
  if (!completed) {
    return { state: 'missing', completedOn: null, renewsOn: null, daysLeft: null };
  }
  const renewsOn = addYears(completed, TRAINING_VALIDITY_YEARS);
  const daysLeft = daysBetween(today, renewsOn);
  const state: TrainingState = daysLeft < 0 ? 'expired' : daysLeft <= TRAINING_DUE_SOON_DAYS ? 'due-soon' : 'valid';
  return { state, completedOn: completed, renewsOn, daysLeft };
}

// ---------- one person ----------

function countRows(rows: ITrainingModuleRow[]): ITrainingCounts {
  const count = (state: TrainingState) => rows.filter(r => r.status.state === state).length;
  return { required: rows.length, valid: count('valid'), dueSoon: count('due-soon'), expired: count('expired'), missing: count('missing') };
}

export function overallState(counts: ITrainingCounts): TrainingOverall {
  if (!counts.required) {
    return 'none';
  }
  if (counts.expired + counts.missing > 0) {
    return 'attention';
  }
  return counts.dueSoon > 0 ? 'due-soon' : 'current';
}

// The most recent completion of each module wins, so an old record never hides a newer one.
function latestByModule(completions: ITrainingCompletion[]): Map<string, string> {
  const latest = new Map<string, string>();
  (completions || []).forEach(c => {
    const date = toIsoDate(c.date);
    if (c && c.module && date && (!latest.has(c.module) || date > latest.get(c.module))) {
      latest.set(c.module, date);
    }
  });
  return latest;
}

export function summariseTraining(areas: string[] | null | undefined, completions: ITrainingCompletion[] | null | undefined, today: string = localIsoDate()): ITrainingSummary {
  const held = TRAINING_AREAS.filter(a => (areas || []).indexOf(a) > -1);
  const latest = latestByModule(completions || []);
  const rowFor = (module: string): ITrainingModuleRow => {
    const info = trainingModuleInfo(module);
    return { module, category: info ? info.category : 'Other', status: moduleStatus(latest.get(module), today) };
  };

  const areaRows: IAreaTraining[] = held.map(area => {
    const modules = TRAINING_REQUIREMENTS[area].map(rowFor);
    return { area, modules, counts: countRows(modules) };
  });

  // Each module needed by any role, counted once.
  const needed = Array.from(new Set(held.reduce((all, area) => all.concat(TRAINING_REQUIREMENTS[area]), [] as string[])));
  const counts = countRows(needed.map(rowFor));
  const other = Array.from(latest.keys()).filter(m => needed.indexOf(m) === -1).sort().map(rowFor);

  return {
    areas: areaRows,
    other,
    counts,
    state: overallState(counts),
    percentCurrent: counts.required ? Math.round(((counts.valid + counts.dueSoon) / counts.required) * 100) : 0,
  };
}

// ---------- what the register's endpoints send ----------

export interface ITrainingUserRow {
  username: string;
  name: string;
  // Sign-in roles (ADMIN, OPERATOR, EXTUSER), which are separate from the areas below.
  roles: string[];
  areas: TrainingArea[];
  counts: ITrainingCounts;
  state: TrainingOverall;
  percentCurrent: number;
}

export interface ITrainingLocation {
  location: string;
  users: ITrainingUserRow[];
}

export interface ITrainingUserDetail {
  username: string;
  name: string;
  roles: string[];
  locations: string[];
  areas: TrainingArea[];
  summary: ITrainingSummary;
}

// Keeps only valid areas, once each and in the catalogue's order.
export function cleanAreas(areas: any): TrainingArea[] {
  return TRAINING_AREAS.filter(a => Array.isArray(areas) && areas.some(x => isTrainingArea(x) && x === a));
}
