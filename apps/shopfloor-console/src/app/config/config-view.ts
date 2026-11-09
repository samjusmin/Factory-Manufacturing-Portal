import { IConfigCategory, IConfigLocation } from '@webproject/data';
import { FilterOption } from '../fat/filter-picker/filter-picker.component';

// How the Config pages word and total things. Kept apart from the components so the figures on the tiles and the
// status of a unit are worked out one way and can be tested without a screen.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const unique = (values: string[]) => Array.from(new Set(values));

// The hardware types a location may use in one category.
export function typesIn(location: IConfigLocation | undefined, category: string): string[] {
  const entries = ((location && location.item_access) || []).filter(i => i.hardware_category === category);
  return unique(entries.reduce((all, i) => all.concat(i.hardware_type || []), [] as string[]));
}

// The line under a location's name: what it can configure.
export function locationSummary(location: IConfigLocation): string {
  const categories = unique(((location && location.item_access) || []).map(i => i.hardware_category));
  if (!categories.length) {
    return 'Nothing set up yet';
  }
  const types = categories.reduce((sum, c) => sum + typesIn(location, c).length, 0);
  return `${categories.length === 1 ? '1 category' : categories.length + ' categories'} · ${plural(types, 'hardware type')}`;
}

// The line under a category's name.
export function categorySummary(location: IConfigLocation | undefined, category: string): string {
  return plural(typesIn(location, category).length, 'hardware type');
}

export interface IProgressState {
  label: string;
  // A po-chip state class (styles.css).
  cls: string;
}

// A unit's checklist progress as a status.
export function progressState(progress: number | null | undefined): IProgressState {
  const value = Number(progress) || 0;
  if (value >= 100) {
    return { label: 'Complete', cls: 'state-complete' };
  }
  return value > 0 ? { label: 'In progress', cls: 'state-in-progress' } : { label: 'Not started', cls: 'state-not-started' };
}

export type ProgressFilter = 'All' | 'Not started' | 'In progress' | 'Complete';

export const PROGRESS_FILTERS: ProgressFilter[] = ['All', 'Not started', 'In progress', 'Complete'];

export function matchesProgress(progress: number | null | undefined, filter: ProgressFilter): boolean {
  return filter === 'All' || progressState(progress).label === filter;
}

// A search matches when every word typed appears in the text.
export function matchesTerm(text: string, term: string): boolean {
  const haystack = (text || '').toLowerCase();
  return term.toLowerCase().split(/\s+/).filter(w => w).every(w => haystack.includes(w));
}

// Icons an admin can give a category (all of them are registered in app.module).
export const CATEGORY_ICONS = ['desktop', 'cubes', 'cogs', 'tools', 'box-open', 'file-invoice', 'search', 'warehouse', 'clipboard-list'];

export interface IUnitColumn {
  name: string;
  label: string;
}

const col = (name: string, label: string): IUnitColumn => ({ name, label });

// The columns of a unit list. Every category lists the serial no. first (it identifies the unit), then what the unit
// is, which project it is allocated to and how far its checklist is. What else is shown follows from the category: an
// image column only where units have a PC image, a parts column only where they have parts.
export function unitColumns(category: IConfigCategory | null | undefined): IUnitColumn[] {
  const columns = [col('serial_no', 'Serial no.'), col('device_name', 'Device name'), col('model', 'Model'), col('project', 'Project')];
  if (category && category.uses_image) {
    columns.push(col('pc_image', 'PC image'));
  }
  if (category && category.parts && category.parts.length) {
    columns.push(col('parts', 'Parts'));
  }
  columns.push(col('progress', 'Progress'), col('state', 'Status'));
  return columns;
}

// What a search looks at in a unit: every value shown in its row, and the serial no. of each part.
export function unitSearchText(unit: any, columns: IUnitColumn[]): string {
  const values = columns.map(c => (c.name === 'parts' ? '' : unit[c.name])).filter(v => v != null);
  const parts = ((unit && unit.parts) || []).map((p: any) => `${p.name} ${p.serial_no}`);
  return values.concat(parts).join(' ');
}

// The project filter on the unit list: All, STOCK, then each project that has units, in the order given.
export function projectFilters(projects: string[], units: Array<{ project?: string }>): string[] {
  const used = new Set(units.map(u => u.project));
  return ['All', ...projects.filter(p => used.has(p) || p === 'STOCK')];
}

// The text the server gave for a refused request, or a fallback when it gave none.
export function errorMessage(error: any, fallback: string): string {
  const message = error && error.error && error.error.message;
  const text = Array.isArray(message) ? message[0] : message;
  return error && error.status >= 400 && error.status < 500 && typeof text === 'string' && text ? text : fallback;
}

// The choices of a list filter: each different value once, in order. Blank values (a row being filled in) are left out.
export function filterOptions(values: Array<string | null | undefined>): FilterOption[] {
  const cleaned = values.map(v => String(v == null ? '' : v).trim()).filter(v => v);
  return unique(cleaned).sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }));
}

// The choices for one column of a list; a column can hold one value or several.
export function rowFilterOptions(rows: any[], key: string): FilterOption[] {
  return filterOptions(rows.reduce((all, row) => all.concat(row[key]), []));
}

// Whether a row passes every filter that has something chosen. A column can hold one value or several.
export function matchesFilters(row: any, selection: { [key: string]: string[] }): boolean {
  return Object.keys(selection).every(key => {
    const chosen = selection[key] || [];
    return !chosen.length || [].concat(row[key]).some(value => chosen.includes(value));
  });
}
