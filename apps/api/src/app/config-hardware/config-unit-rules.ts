import { BadRequestException } from '@nestjs/common';
import { IConfigCheck, IConfigUnitPart, cleanSerial, sameSerial } from '@webproject/data';

// The rules a Config unit has to follow, kept apart from the database code so they can be tested on their own.

export const CHECK_STATUSES = ['Complete', 'Incomplete', 'N/A'];

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A match for exactly this serial no., whatever its letter case.
export function serialMatcher(serial: string): RegExp {
  return new RegExp('^' + escapeRegExp(cleanSerial(serial)) + '$', 'i');
}

export interface ICheckChange {
  index: number;
  status?: string | null;
  comment?: string | null;
}

// Puts the answers a user changed onto a checklist. Only the rows named are touched; a row that now has an answer is
// stamped with who gave it and when, and one that was cleared loses its stamp. Section headings take no answers.
export function applyChanges(checklist: IConfigCheck[], changes: any, who: string, when: string): IConfigCheck[] {
  const rows = (checklist || []).map((row) => ({ ...row }));
  if (changes === undefined || changes === null) {
    return rows;
  }
  if (!Array.isArray(changes)) {
    throw new BadRequestException('The changes must be a list.');
  }
  changes.forEach((change: ICheckChange) => {
    const row = Number.isInteger(change && change.index) ? rows[change.index] : undefined;
    if (!row) {
      throw new BadRequestException('One of the checks no longer exists. Reload the page and try again.');
    }
    if (row.reference === 'Heading') {
      throw new BadRequestException('A section heading cannot be answered.');
    }
    const status = change.status || null;
    if (status !== null && !CHECK_STATUSES.includes(status)) {
      throw new BadRequestException(`"${status}" is not an answer. Use Complete, Incomplete or N/A.`);
    }
    row.status = status;
    row.comment = change.comment ? String(change.comment) : null;
    row.checked_by = status ? who : null;
    row.date_checked = status ? when : null;
  });
  return rows;
}

// The parts a category defines, each with the serial no. the user gave it (blank is allowed). A part's serial must not
// repeat the unit's own or another part's.
export function resolveParts(partNames: string[], given: any, serial: string): IConfigUnitPart[] {
  if (!partNames || !partNames.length) {
    return [];
  }
  const list: any[] = Array.isArray(given) ? given : [];
  const parts = partNames.map((name) => {
    const found = list.find((p) => p && p.name === name);
    return { name, serial_no: cleanSerial(found && found.serial_no) };
  });
  const filled = parts.filter((p) => p.serial_no);
  filled.forEach((part, i) => {
    if (sameSerial(part.serial_no, serial)) {
      throw new BadRequestException(`${part.name} has the same serial no. as the unit itself.`);
    }
    if (filled.findIndex((p) => sameSerial(p.serial_no, part.serial_no)) !== i) {
      throw new BadRequestException(`${part.serial_no} is used for more than one part.`);
    }
  });
  return parts;
}

// Which model a unit gets. With one model available it is filled in; with several the user must choose; with none the
// unit has no model. A model the unit already has stays allowed even if the location's list has since changed.
export function resolveModel(options: string[], given: any, existing: string | null, category: string, location: string): string | null {
  const chosen = given === undefined || given === null || String(given).trim() === '' ? null : String(given).trim();
  if (chosen && chosen === existing) {
    return chosen;
  }
  if (!options.length) {
    if (chosen) {
      throw new BadRequestException(`${location} has no ${category} models set up, so a model cannot be chosen.`);
    }
    return null;
  }
  if (!chosen) {
    if (options.length === 1) {
      return options[0];
    }
    throw new BadRequestException('Choose a model.');
  }
  if (!options.includes(chosen)) {
    throw new BadRequestException(`"${chosen}" is not a ${category} model available at ${location}.`);
  }
  return chosen;
}
