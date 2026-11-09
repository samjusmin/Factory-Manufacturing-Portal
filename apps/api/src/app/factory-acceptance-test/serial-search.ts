// Builds the database queries behind Deep Search. Kept apart from the service so the shape of the query can be tested
// without a database.
//
// The order of the stages is what keeps it fast on a lot of data:
//   1. the filters (project, phase, type, location) are applied to the units first, before anything is unwound, so
//      the database can use its indexes and only touches the units that are wanted;
//   2. only the two categories that hold names and serial numbers are kept from each unit;
//   3. the search text is applied last, to what is left;
//   4. only one page of rows is ever sent back (a separate count gives the total).

import { ISerialSearchQuery } from '@webproject/data';

export const SERIAL_CATEGORIES = ['Serial Numbers', 'Unit Name'];

// Text typed by a user is looked for as plain text, never as a pattern.
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The filters, applied to the unit documents.
export function unitFilter(query: ISerialSearchQuery): any {
  const match: any = {};
  if (query.project.length) { match.project = { $in: query.project }; }
  if (query.phase.length) { match.phase = { $in: query.phase }; }
  if (query.unit_type.length) { match.unit_type = { $in: query.unit_type }; }
  if (query.location.length) { match.location = { $in: query.location }; }
  // Complete is 100%; anything else (including a unit with no progress recorded) is incomplete. Both chosen means no filter.
  const wantsComplete = query.status.indexOf('complete') > -1;
  const wantsIncomplete = query.status.indexOf('incomplete') > -1;
  if (wantsComplete && !wantsIncomplete) {
    match.progress = { $gte: 100 };
  } else if (wantsIncomplete && !wantsComplete) {
    match.$or = [{ progress: { $lt: 100 } }, { progress: null }];
  }
  return match;
}

// The text search, applied to the rows. A phase is found by its name, and a unit type by its stored value (so
// "unit z" also finds "unit-z").
export function textFilter(text: string): any | null {
  const term = text.trim();
  if (!term) {
    return null;
  }
  const plain = { $regex: escapeRegex(term), $options: 'i' };
  const asType = { $regex: escapeRegex(term.replace(/\s+/g, '-')), $options: 'i' };
  return {
    $or: [
      { doc_no: plain }, { unit_no: plain }, { serial_no: plain }, { project: plain }, { phase_name: plain },
      { location: plain }, { unit_type: asType },
    ],
  };
}

// The search text as a test on whole units, run before anything is unwound. It lets through every unit that could have
// a matching row (a unit whose own details match, or that has a name or serial number containing the text), so the
// exact row-by-row test later only has to look at those. A phase is found by its name, so the ids of the phases whose
// name contains the text are used.
export function unitTextPrefilter(text: string, phases: Array<{ id: string, name: string }>): any | null {
  const term = text.trim();
  if (!term) {
    return null;
  }
  const plain = { $regex: escapeRegex(term), $options: 'i' };
  const asType = { $regex: escapeRegex(term.replace(/\s+/g, '-')), $options: 'i' };
  const lower = term.toLowerCase();
  const phaseIds = phases.filter(p => (p.name || '').toLowerCase().indexOf(lower) !== -1).map(p => p.id);
  const either: any[] = [
    { doc_no: plain }, { unit_no: plain }, { project: plain }, { location: plain }, { unit_type: asType },
    { 'category.checklists.comment': plain },
  ];
  if (phaseIds.length) {
    either.push({ phase: { $in: phaseIds } });
  }
  return { $or: either };
}

// Everything up to (and including) the search, before sorting and paging. `phases` lists every phase's id and name so
// the name can be added to each row without a join.
// `countOnly` is for the total: it does not need the display fields unless the search text looks at them.
export function rowPipeline(query: ISerialSearchQuery, phases: Array<{ id: string, name: string }>, countOnly = false): any[] {
  const pipeline: any[] = [];
  const units = unitFilter(query);
  const prefilter = unitTextPrefilter(query.q, phases);
  const first = prefilter ? { $and: [units, prefilter] } : units;
  if (prefilter || Object.keys(units).length) {
    pipeline.push({ $match: first });
  }

  pipeline.push(
    {
      $project: {
        _id: 0, doc_no: 1, unit_no: 1, project: 1, phase: 1, unit_type: 1, location: 1, progress: 1,
        category: { $filter: { input: '$category', as: 'c', cond: { $in: ['$$c.name', SERIAL_CATEGORIES] } } },
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: false } },
    { $unwind: { path: '$category.checklists', preserveNullAndEmptyArrays: false } },
    // Only rows where a name or serial number has actually been entered
    { $match: { 'category.checklists.comment': { $nin: [null, ''] } } },
  );

  const text = textFilter(query.q);
  if (!countOnly || text) {
    pipeline.push({
      $addFields: {
        serial_no: '$category.checklists.comment',
        phase_name: {
          $let: {
            vars: { at: { $indexOfArray: [{ $literal: phases.map(p => p.id) }, '$phase'] } },
            in: { $cond: [{ $gte: ['$$at', 0] }, { $arrayElemAt: [{ $literal: phases.map(p => p.name) }, '$$at'] }, '$phase'] },
          },
        },
      },
    },
    { $project: { category: 0 } });
  }
  if (text) {
    pipeline.push({ $match: text });
  }
  return pipeline;
}

// One page of rows. The second and third sort keys make the order the same every time, which paging relies on.
export function pagePipeline(query: ISerialSearchQuery, phases: Array<{ id: string, name: string }>): any[] {
  const direction = query.dir === 'desc' ? -1 : 1;
  const sort: any = { [query.sort]: direction };
  if (query.sort !== 'doc_no') { sort.doc_no = 1; }
  if (query.sort !== 'serial_no') { sort.serial_no = 1; }
  return [
    ...rowPipeline(query, phases),
    { $sort: sort },
    { $skip: (query.page - 1) * query.pageSize },
    { $limit: query.pageSize },
  ];
}

export function countPipeline(query: ISerialSearchQuery, phases: Array<{ id: string, name: string }>): any[] {
  return [...rowPipeline(query, phases, true), { $count: 'total' }];
}

// Sorting treats "UZ10" as coming after "UZ9" and ignores case.
export const SORT_COLLATION = { locale: 'en', numericOrdering: true, strength: 2 };
