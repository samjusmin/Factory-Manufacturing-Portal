// Deep Search: finding a unit by its name or serial number across every project. With a lot of units the list cannot
// be sent to the browser whole, so the server filters, sorts and pages it and the browser asks for one page at a
// time. These types and the query rules are shared so both sides agree on them.

export const SERIAL_SEARCH_PAGE_SIZES = [10, 25, 50, 100];
export const SERIAL_SEARCH_DEFAULT_PAGE_SIZE = 25;
export const SERIAL_SEARCH_MAX_TEXT = 100;
// A filter never needs more than this many values; the limit stops a runaway request.
export const SERIAL_SEARCH_MAX_FILTER_VALUES = 50;

export type SerialSearchSort = 'doc_no' | 'unit_no' | 'serial_no' | 'project' | 'phase_name' | 'unit_type' | 'location' | 'progress';
export const SERIAL_SEARCH_SORTS: SerialSearchSort[] = ['doc_no', 'unit_no', 'serial_no', 'project', 'phase_name', 'unit_type', 'location', 'progress'];

// The four things a search can be narrowed by. Filters stack (a unit must match every filter that has a value);
// within one filter, any of its chosen values matches.
export type SerialSearchFilterKey = 'project' | 'phase' | 'unit_type' | 'location' | 'status';
export const SERIAL_SEARCH_FILTER_KEYS: SerialSearchFilterKey[] = ['project', 'phase', 'unit_type', 'location', 'status'];

// The progress filter: a unit is complete at 100%, and incomplete below that. Choosing both is the same as not filtering.
export const SERIAL_SEARCH_STATUSES = ['complete', 'incomplete'];

export interface ISerialSearchQuery {
  // Text to look for. It only looks within the units the filters leave.
  q: string;
  project: string[];
  // Phase ids (not names).
  phase: string[];
  unit_type: string[];
  location: string[];
  // 'complete' and/or 'incomplete' (see SERIAL_SEARCH_STATUSES).
  status: string[];
  // 1-based.
  page: number;
  pageSize: number;
  sort: SerialSearchSort;
  dir: 'asc' | 'desc';
}

export interface ISerialSearchRow {
  doc_no: string;
  unit_no: string;
  serial_no: string;
  project: string;
  phase: string;
  phase_name: string;
  unit_type: string;
  location: string;
  progress: number;
}

export interface ISerialSearchResult {
  rows: ISerialSearchRow[];
  // How many rows match in all (not just on this page).
  total: number;
  page: number;
  pageSize: number;
}

// What the filter lists offer.
export interface ISerialSearchFilters {
  projects: string[];
  phases: Array<{ id: string, name: string, project: string }>;
  unit_types: string[];
  locations: string[];
}

function asList(value: any): string[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
  const clean = list.map(v => String(v).trim()).filter(v => v !== '' && v.length <= 200);
  return Array.from(new Set(clean)).slice(0, SERIAL_SEARCH_MAX_FILTER_VALUES);
}

function asInt(value: any, fallback: number): number {
  const n = parseInt(String(value), 10);
  return isNaN(n) ? fallback : n;
}

// Turns whatever arrived (a request's query string, or the address of the page) into a safe query: unknown sort
// columns fall back to the default, the page size is one of the allowed sizes, and text is trimmed and capped.
export function parseSerialSearchQuery(raw: any): ISerialSearchQuery {
  raw = raw || {};
  const pageSize = SERIAL_SEARCH_PAGE_SIZES.indexOf(asInt(raw.pageSize, 0)) > -1 ? asInt(raw.pageSize, 0) : SERIAL_SEARCH_DEFAULT_PAGE_SIZE;
  const sort = SERIAL_SEARCH_SORTS.indexOf(raw.sort) > -1 ? raw.sort as SerialSearchSort : 'doc_no';
  return {
    q: String(raw.q === undefined || raw.q === null ? '' : raw.q).trim().slice(0, SERIAL_SEARCH_MAX_TEXT),
    project: asList(raw.project),
    phase: asList(raw.phase),
    unit_type: asList(raw.unit_type),
    location: asList(raw.location),
    status: asList(raw.status).filter(v => SERIAL_SEARCH_STATUSES.indexOf(v) > -1),
    page: Math.max(1, asInt(raw.page, 1)),
    pageSize,
    sort,
    dir: raw.dir === 'desc' ? 'desc' : 'asc',
  };
}
