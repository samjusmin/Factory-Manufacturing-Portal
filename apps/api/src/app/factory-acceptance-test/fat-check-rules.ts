import { BadRequestException, ConflictException } from '@nestjs/common';
import { CHECK_STATUSES } from '../config-hardware/config-unit-rules';

// The rules a FAT checklist save has to follow, kept apart from the database code so they can be tested on their own.

// What a user can edit on a check; an empty box and a missing value count as the same.
const answers = (row: any) => JSON.stringify([row.status || '', row.comment || '', row.second_checker || '']);

const text = (value: any): string | null => (value === undefined || value === null || value === '' ? null : String(value));

// Puts a user's answers onto the stored checklist. Only the answers are taken from the user: the wording of each check
// stays as stored, and who answered and when are always set here, so they cannot be made up. A row whose answers did
// not change keeps its stamp; one that was changed is stamped with this user, or loses its stamp if the answer went.
export function stampChecks(stored: any[], incoming: any[], who: string, when: string): any[] {
  if (stored.length !== incoming.length || stored.some((row, i) => !incoming[i] || row.description !== incoming[i].description)) {
    // Not the checklist this user was looking at. The page treats this like someone else having saved first.
    throw new ConflictException('This checklist was changed by someone else.');
  }
  return stored.map((row, i) => {
    const given = incoming[i];
    if (row.reference === 'Heading' || answers(row) === answers(given)) {
      return row;
    }
    const status = text(given.status);
    if (status !== null && !CHECK_STATUSES.includes(status)) {
      throw new BadRequestException(`"${status}" is not an answer. Use Complete, Incomplete or N/A.`);
    }
    return {
      ...row,
      status,
      comment: text(given.comment),
      second_checker: text(given.second_checker),
      checked_by: status ? who : null,
      date_checked: status ? when : null,
    };
  });
}

// The unit numbers an "add units" form would create, in order.
export function newUnitNumbers(entries: any[]): string[] {
  const numbers: string[] = [];
  (entries || []).forEach((entry) => {
    for (let i = 0; i < entry.number; i++) {
      numbers.push(entry.prefix + (entry.start + i).toString());
    }
  });
  return numbers;
}
