import { isFatHeading } from './fat-checks';

// What Config keeps track of, shared by the API and the app so both count and name things the same way.
//
// A *category* (PC, Network Switch...) says how its units look: whether they use a PC image and which parts they have.
// A *type* (Kiosk A PC, 5-port D-Link...) belongs to one category and carries the checklist a new unit starts from.
// A *unit* is one piece of hardware at a location, identified by its serial no., allocated to a project or to STOCK.

// Items that have not been allocated to a project. Every location has it; it cannot be removed.
export const STOCK_PROJECT = 'STOCK';

export interface IConfigCategory {
  name: string;
  // A registered Font Awesome icon name for the category's tile.
  icon: string;
  // Units of this category have a PC image.
  uses_image: boolean;
  // Names of the extra parts a unit has, each with its own serial no. (a UNIT-W1 set has four members).
  parts: string[];
}

// One row of a checklist: a check, or a section heading when `reference` is 'Heading'.
export interface IConfigCheck {
  description: string;
  reference?: string | null;
  status?: string | null;
  checked_by?: string | null;
  date_checked?: string | Date | null;
  comment?: string | null;
}

export interface IConfigType {
  category: string;
  name: string;
  checklist: IConfigCheck[];
}

// A category with the names of its types, as the catalogue lists them.
export interface IConfigCatalogueCategory extends IConfigCategory {
  types: string[];
}

export interface IConfigCatalogue {
  categories: IConfigCatalogueCategory[];
}

export interface IConfigUnitPart {
  name: string;
  serial_no: string;
}

// A location's project codes: STOCK first, then the codes an admin created (each once).
export function locationProjects(projects: string[] | null | undefined): string[] {
  const codes = (projects || []).map(cleanProjectCode).filter(code => code && code !== STOCK_PROJECT);
  return [STOCK_PROJECT, ...Array.from(new Set(codes))];
}

// Project codes are upper case with single spaces, so "prj  alpha " and "PRJ ALPHA" are the same project.
export function cleanProjectCode(code: string | null | undefined): string {
  return String(code || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

// Serial numbers are compared without surrounding spaces or letter case.
export function cleanSerial(serial: string | null | undefined): string {
  return String(serial || '').trim();
}

export function sameSerial(a: string | null | undefined, b: string | null | undefined): boolean {
  return cleanSerial(a).toLowerCase() === cleanSerial(b).toLowerCase();
}

// The checks in a list (section headings are not checks).
export function checkRows<T extends { reference?: string | null }>(rows: T[] | null | undefined): T[] {
  return (rows || []).filter(row => !isFatHeading(row));
}

// A check counts as done when it is Complete or N/A: the rule FAT uses for its progress figure.
export function isCheckDone(row: { status?: string | null }): boolean {
  return row.status === 'Complete' || row.status === 'N/A';
}

// Whole-number percentage of the checks that are done, across the whole checklist (not just the rows just edited).
export function checklistProgress(rows: Array<{ reference?: string | null; status?: string | null }> | null | undefined): number {
  const checks = checkRows(rows);
  return checks.length ? Math.round((checks.filter(isCheckDone).length / checks.length) * 100) : 0;
}
