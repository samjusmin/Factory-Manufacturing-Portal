// What to do when someone else saved a checklist while you were editing it.
//
// Three versions of each row are compared: what you loaded (the base), what is on your screen now (mine), and what
// is on the server now (theirs). A row only you changed keeps your change, a row only they changed shows theirs, and
// a row you both changed to different things is a conflict for you to settle. Nothing is saved by the merge itself.

import { FATchecklist } from '@webproject/data';

// What the merge needs of a row: a FAT check and a Config check both fit.
export interface IChecklistRow {
  description?: string;
  reference?: string | null;
  status?: string | null;
  comment?: string | null;
  second_checker?: string | null;
  checked_by?: string | null;
  date_checked?: any;
}

// The values a user can edit; an empty box and a missing value count as the same.
export function checkSnapshot(row: IChecklistRow): string {
  return JSON.stringify([row.status || '', row.comment || '', row.second_checker || '']);
}

export interface ChecklistConflict<T extends IChecklistRow = FATchecklist> {
  index: number;
  description: string;
  mine: T;
  theirs: T;
}

export interface ChecklistMerge<T extends IChecklistRow = FATchecklist> {
  // The rows to show: yours where only you changed, theirs otherwise. A conflicting row starts as yours.
  rows: T[];
  conflicts: ChecklistConflict<T>[];
  // How many rows now show another person's change.
  fromOthers: number;
  // How many rows still hold a change of yours that the server does not have.
  yours: number;
}

// `base` holds the snapshot (see checkSnapshot) of every row as it was loaded. Returns null when the lists no longer
// line up (the checklist itself was changed), in which case there is nothing sensible to merge.
export function mergeChecklist<T extends IChecklistRow>(base: string[], mine: T[], theirs: T[]): ChecklistMerge<T> | null {
  if (base.length !== mine.length || mine.length !== theirs.length) {
    return null;
  }

  const rows: T[] = [];
  const conflicts: ChecklistConflict<T>[] = [];
  let fromOthers = 0;
  let yours = 0;

  mine.forEach((mineRow, i) => {
    const theirRow = theirs[i];
    // Section headings carry no answers, so there is nothing to merge.
    if (mineRow.reference === 'Heading' || theirRow.reference === 'Heading') {
      rows.push(theirRow);
      return;
    }
    const b = base[i];
    const m = checkSnapshot(mineRow);
    const t = checkSnapshot(theirRow);

    if (m === t) {
      // The same on both sides (including both unchanged): take the server's row, which has the right stamps.
      rows.push(theirRow);
    } else if (m === b) {
      // Only they changed it.
      rows.push(theirRow);
      fromOthers++;
    } else if (t === b) {
      // Only you changed it.
      rows.push(mineRow);
      yours++;
    } else {
      // You both changed it, to different things.
      rows.push(mineRow);
      yours++;
      conflicts.push({ index: i, description: mineRow.description || '', mine: mineRow, theirs: theirRow });
    }
  });

  return { rows, conflicts, fromOthers, yours };
}
