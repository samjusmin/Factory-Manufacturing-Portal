import { SERIAL_SEARCH_DEFAULT_PAGE_SIZE, SERIAL_SEARCH_MAX_FILTER_VALUES, parseSerialSearchQuery } from './fat-search';

describe('parseSerialSearchQuery', () => {
  it('gives sensible defaults for an empty request', () => {
    expect(parseSerialSearchQuery(undefined)).toEqual({
      q: '', project: [], phase: [], unit_type: [], location: [], status: [], page: 1, pageSize: SERIAL_SEARCH_DEFAULT_PAGE_SIZE, sort: 'doc_no', dir: 'asc',
    });
  });

  it('accepts a filter as one value or a list, trimming blanks and repeats', () => {
    const q = parseSerialSearchQuery({ project: 'A', phase: ['p1', ' p1 ', '', 'p2'], unit_type: [], location: 'Dock, East' });
    expect(q.project).toEqual(['A']);
    expect(q.phase).toEqual(['p1', 'p2']);
    expect(q.unit_type).toEqual([]);
    // A comma is part of a name, not a separator.
    expect(q.location).toEqual(['Dock, East']);
  });

  it('only accepts the two progress values', () => {
    expect(parseSerialSearchQuery({ status: ['complete', 'incomplete'] }).status).toEqual(['complete', 'incomplete']);
    expect(parseSerialSearchQuery({ status: 'complete' }).status).toEqual(['complete']);
    expect(parseSerialSearchQuery({ status: ['done', 'complete', '$ne'] }).status).toEqual(['complete']);
  });

  it('keeps the page number and size inside the allowed range', () => {
    expect(parseSerialSearchQuery({ page: '3', pageSize: '50' })).toEqual(expect.objectContaining({ page: 3, pageSize: 50 }));
    expect(parseSerialSearchQuery({ page: '0' }).page).toBe(1);
    expect(parseSerialSearchQuery({ page: '-4' }).page).toBe(1);
    expect(parseSerialSearchQuery({ page: 'abc' }).page).toBe(1);
    // Only the offered page sizes are allowed, so nobody can ask for a million rows at once.
    expect(parseSerialSearchQuery({ pageSize: '1000000' }).pageSize).toBe(SERIAL_SEARCH_DEFAULT_PAGE_SIZE);
    expect(parseSerialSearchQuery({ pageSize: '7' }).pageSize).toBe(SERIAL_SEARCH_DEFAULT_PAGE_SIZE);
  });

  it('only sorts by a known column, ascending unless told otherwise', () => {
    expect(parseSerialSearchQuery({ sort: 'progress', dir: 'desc' })).toEqual(expect.objectContaining({ sort: 'progress', dir: 'desc' }));
    expect(parseSerialSearchQuery({ sort: '$where', dir: 'sideways' })).toEqual(expect.objectContaining({ sort: 'doc_no', dir: 'asc' }));
  });

  it('trims the search text and caps its length', () => {
    expect(parseSerialSearchQuery({ q: '  sn-100 ' }).q).toBe('sn-100');
    expect(parseSerialSearchQuery({ q: 'x'.repeat(500) }).q.length).toBe(100);
    expect(parseSerialSearchQuery({ q: null }).q).toBe('');
  });

  it('limits how many values a filter can hold', () => {
    const many = Array.from({ length: 200 }, (_, i) => 'v' + i);
    expect(parseSerialSearchQuery({ project: many }).project.length).toBe(SERIAL_SEARCH_MAX_FILTER_VALUES);
  });
});
