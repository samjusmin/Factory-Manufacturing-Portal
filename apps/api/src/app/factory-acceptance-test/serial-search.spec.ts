import { parseSerialSearchQuery } from '@webproject/data';
import { SORT_COLLATION, countPipeline, escapeRegex, pagePipeline, rowPipeline, textFilter, unitFilter, unitTextPrefilter } from './serial-search';

const phases = [{ id: 'p1', name: 'Phase 1' }, { id: 'p2', name: '$weird' }];
const query = (raw: any = {}) => parseSerialSearchQuery(raw);

describe('serial search queries', () => {
  it('applies the filters to the units first, before anything is unwound', () => {
    const pipeline = rowPipeline(query({ project: ['A', 'B'], phase: 'p1', unit_type: 'unit-z', location: 'HQ' }), phases);
    expect(pipeline[0]).toEqual({ $match: { project: { $in: ['A', 'B'] }, phase: { $in: ['p1'] }, unit_type: { $in: ['unit-z'] }, location: { $in: ['HQ'] } } });
    expect(Object.keys(pipeline[1])[0]).toBe('$project');
    expect(pipeline.findIndex(s => s.$unwind)).toBeGreaterThan(1);
  });

  it('has no unit filter at all when nothing is chosen, and stacks only the filters that are set', () => {
    expect(unitFilter(query())).toEqual({});
    expect(rowPipeline(query(), phases)[0].$project).toBeDefined();
    expect(unitFilter(query({ project: 'A', location: 'HQ' }))).toEqual({ project: { $in: ['A'] }, location: { $in: ['HQ'] } });
  });

  it('filters by progress: complete is 100%, incomplete is anything else, both is no filter', () => {
    expect(unitFilter(query({ status: 'complete' }))).toEqual({ progress: { $gte: 100 } });
    expect(unitFilter(query({ status: 'incomplete' }))).toEqual({ $or: [{ progress: { $lt: 100 } }, { progress: null }] });
    expect(unitFilter(query({ status: ['complete', 'incomplete'] }))).toEqual({});
    // It stacks with the other filters, and is applied to the units before anything is unwound.
    const pipeline = rowPipeline(query({ status: 'complete', project: 'A' }), phases);
    expect(pipeline[0]).toEqual({ $match: { project: { $in: ['A'] }, progress: { $gte: 100 } } });
  });

  it('keeps only the name and serial number categories of each unit before unwinding them', () => {
    const project = rowPipeline(query(), phases)[0].$project;
    expect(project.category.$filter.cond).toEqual({ $in: ['$$c.name', ['Serial Numbers', 'Unit Name']] });
  });

  it('adds the phase name without a join, and treats a phase name starting with $ as plain text', () => {
    const add = rowPipeline(query(), phases).find(s => s.$addFields).$addFields;
    expect(add.serial_no).toBe('$category.checklists.comment');
    expect(JSON.stringify(add.phase_name)).toContain('{"$literal":["Phase 1","$weird"]}');
  });

  it('applies the search text last, as plain text across the visible columns, within the filters', () => {
    const pipeline = rowPipeline(query({ q: 'unit z', project: 'A' }), phases);
    const last = pipeline[pipeline.length - 1];
    const fields = last.$match.$or.map(c => Object.keys(c)[0]);
    expect(fields).toEqual(['doc_no', 'unit_no', 'serial_no', 'project', 'phase_name', 'location', 'unit_type']);
    // A unit type is stored as unit-z, so a space is matched as a dash there.
    expect(last.$match.$or.find(c => c.unit_type).unit_type.$regex).toBe('unit-z');
    expect(pipeline[0].$match.$and[0].project).toEqual({ $in: ['A'] });
    expect(rowPipeline(query(), phases).some(s => s.$match && s.$match.$or)).toBe(false);
  });

  it('skips units that cannot match the text before unwinding them, together with the filters', () => {
    const pipeline = rowPipeline(query({ q: 'phase 1', project: 'A' }), phases);
    const first = pipeline[0].$match;
    expect(first.$and[0]).toEqual({ project: { $in: ['A'] } });
    const fields = first.$and[1].$or.map(c => Object.keys(c)[0]);
    expect(fields).toEqual(['doc_no', 'unit_no', 'project', 'location', 'unit_type', 'category.checklists.comment', 'phase']);
    // A phase is found by its name: "phase 1" matches the phase called "Phase 1" (id p1).
    expect(first.$and[1].$or.find(c => c.phase).phase).toEqual({ $in: ['p1'] });
    // The exact row-by-row test still runs afterwards.
    expect(pipeline[pipeline.length - 1].$match.$or).toBeDefined();
  });

  it('has no unit-level text test when there is no text, or when no phase name matches', () => {
    expect(unitTextPrefilter('  ', phases)).toBeNull();
    expect(rowPipeline(query(), phases)[0].$match).toBeUndefined();
    expect(unitTextPrefilter('xyz', phases).$or.some(c => c.phase)).toBe(false);
  });

  it('never lets typed text act as a pattern', () => {
    expect(escapeRegex('a.b*c(d)[e]\\')).toBe('a\\.b\\*c\\(d\\)\\[e\\]\\\\');
    expect(textFilter('.*').$or[0].doc_no.$regex).toBe('\\.\\*');
    expect(textFilter('   ')).toBeNull();
  });

  it('pages and sorts in a stable order, sending back only one page', () => {
    const pipeline = pagePipeline(query({ sort: 'progress', dir: 'desc', page: 3, pageSize: 25 }), phases);
    const tail = pipeline.slice(-3);
    expect(tail[0]).toEqual({ $sort: { progress: -1, doc_no: 1, serial_no: 1 } });
    expect(tail[1]).toEqual({ $skip: 50 });
    expect(tail[2]).toEqual({ $limit: 25 });
    expect(pagePipeline(query({ sort: 'doc_no' }), phases).slice(-3)[0]).toEqual({ $sort: { doc_no: 1, serial_no: 1 } });
  });

  it('counts the matching rows with the same filters', () => {
    const pipeline = countPipeline(query({ q: 'x' }), phases);
    expect(pipeline[pipeline.length - 1]).toEqual({ $count: 'total' });
    expect(pipeline.length).toBe(rowPipeline(query({ q: 'x' }), phases).length + 1);
  });

  it('sorts numbers inside names in natural order', () => {
    expect(SORT_COLLATION.numericOrdering).toBe(true);
  });
});
