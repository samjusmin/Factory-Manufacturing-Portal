import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FATSerialNumberComponent } from './fat-serial-lookup.component';
import { FATProjectService } from '../fat-project.service';

const filters = {
  projects: ['PRJ-A', 'PRJ-B'],
  phases: [
    { id: 'p1', name: 'Phase 1', project: 'PRJ-A' },
    { id: 'p2', name: 'Phase 2', project: 'PRJ-A' },
    { id: 'p3', name: 'Phase 1', project: 'PRJ-B' },
  ],
  unit_types: ['unit-x1', 'unit-z'],
  locations: ['Meridian HQ', 'Northwind Partners'],
};

const row = (doc_no: string, serial_no: string) => ({
  doc_no, unit_no: '', serial_no, project: 'PRJ-A', phase: 'p1', phase_name: 'Phase 1', unit_type: 'unit-z', location: 'Meridian HQ', progress: 40,
});
const page = (rows: any[], total = rows.length, p = 1, pageSize = 25) => ({ rows, total, page: p, pageSize });

describe('FATSerialNumberComponent (Deep Search)', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATSerialNumberComponent;
  let fixture: ComponentFixture<FATSerialNumberComponent>;
  let navigate: jest.SpyInstance;

  // The search requests made so far, as the query strings they carry.
  const searches = () => http.match(r => r.url === '/api/factory-acceptance-test/serial-search');
  const lastParams = (req: any) => {
    const p = req.request.params;
    return {
      q: p.get('q'), page: p.get('page'), pageSize: p.get('pageSize'), sort: p.get('sort'), dir: p.get('dir'),
      project: p.getAll('project') || [], phase: p.getAll('phase') || [], unit_type: p.getAll('unit_type') || [], location: p.getAll('location') || [],
    };
  };

  const create = async (queryParams: any = {}) => {
    await TestBed.configureTestingModule({
      declarations: [FATSerialNumberComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParams } } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(FATSerialNumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/serial-search/filters').flush(filters);
  };

  afterEach(() => {
    http.match(() => true);
  });

  it('asks the server for the first page only, never for everything', async () => {
    await create();
    const [first] = searches();
    expect(lastParams(first)).toEqual(expect.objectContaining({ page: '1', pageSize: '25', sort: 'doc_no', dir: 'asc', q: '' }));
    first.flush(page([row('UZ1', 'S1')], 312));
    expect(component.rangeText).toBe('Showing 1-25 of 312 results');
  });

  it('starts from the search in the address', async () => {
    await create({ q: 'sn-1', project: 'PRJ-A', unit_type: ['unit-z', 'unit-x1'], page: '3', pageSize: '50', sort: 'progress', dir: 'desc' });
    const [first] = searches();
    expect(lastParams(first)).toEqual({ q: 'sn-1', page: '3', pageSize: '50', sort: 'progress', dir: 'desc', project: ['PRJ-A'], phase: [], unit_type: ['unit-z', 'unit-x1'], location: [] });
    first.flush(page([], 0, 3, 50));
  });

  it('stacks filters, and the search text is sent along with them', async () => {
    await create();
    searches()[0].flush(page([]));
    component.onFilterChange('project', ['PRJ-A']);
    component.onFilterChange('unit_type', ['unit-z']);
    component.onFilterChange('location', ['Meridian HQ', 'Northwind Partners']);
    component.onSearchInput('  sn-100 ');
    const all = searches();
    // Filter changes search at once; typing waits for a pause (see the next test).
    expect(all.length).toBe(3);
    expect(lastParams(all[2])).toEqual(expect.objectContaining({
      project: ['PRJ-A'], unit_type: ['unit-z'], location: ['Meridian HQ', 'Northwind Partners'], phase: [],
    }));
    expect(component.activeFilters.map(f => f.key + ':' + f.value)).toEqual([
      'project:PRJ-A', 'unit_type:unit-z', 'location:Meridian HQ', 'location:Northwind Partners',
    ]);
  });

  it('waits for a pause in typing, then searches inside the filters', fakeAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FATSerialNumberComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: { project: 'PRJ-A' } } } }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(FATSerialNumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/serial-search/filters').flush(filters);
    searches()[0].flush(page([]));

    component.onSearchInput('s');
    tick(100);
    component.onSearchInput('sn');
    tick(100);
    component.onSearchInput('sn-1');
    tick(100);
    expect(searches().length).toBe(0);
    tick(300);
    const [only] = searches();
    expect(lastParams(only)).toEqual(expect.objectContaining({ q: 'sn-1', project: ['PRJ-A'], page: '1' }));
  }));

  it('goes back to the first page when the search or a filter changes, but not when paging', async () => {
    await create({ page: '4' });
    searches()[0].flush(page([row('UZ1', 'S1')], 500, 4));
    component.onFilterChange('location', ['Meridian HQ']);
    expect(lastParams(searches()[0]).page).toBe('1');

    component.onPage({ pageIndex: 2, pageSize: 25, length: 500 } as any);
    expect(lastParams(searches()[0]).page).toBe('3');
    // A new page size starts again from the first page.
    component.onPage({ pageIndex: 2, pageSize: 100, length: 500 } as any);
    expect(lastParams(searches()[0])).toEqual(expect.objectContaining({ page: '1', pageSize: '100' }));
  });

  it('sorts on the server, falling back to the default order when the sort is cleared', async () => {
    await create();
    searches()[0].flush(page([]));
    component.onSort({ active: 'progress', direction: 'desc' });
    expect(lastParams(searches()[0])).toEqual(expect.objectContaining({ sort: 'progress', dir: 'desc', page: '1' }));
    component.onSort({ active: 'progress', direction: '' });
    expect(lastParams(searches()[0])).toEqual(expect.objectContaining({ sort: 'doc_no', dir: 'asc' }));
  });

  it('offers only the phases of the chosen projects, and drops a chosen phase that no longer fits', async () => {
    await create({ phase: ['p1', 'p3'] });
    searches()[0].flush(page([]));
    expect(component.optionLists.phase.map(o => o.value)).toEqual(['p1', 'p2', 'p3']);
    component.onFilterChange('project', ['PRJ-B']);
    expect(component.optionLists.phase.map(o => o.value)).toEqual(['p3']);
    expect(component.query.phase).toEqual(['p3']);
    component.onFilterChange('project', []);
    expect(component.optionLists.phase.length).toBe(3);
  });

  it('removes one filter or all of them', async () => {
    await create({ project: 'PRJ-A', unit_type: 'unit-z' });
    searches()[0].flush(page([]));
    component.removeFilter(component.activeFilters[0]);
    expect(component.query.project).toEqual([]);
    expect(component.query.unit_type).toEqual(['unit-z']);
    component.clearFilters();
    expect(component.hasFilters).toBe(false);
    expect(component.activeFilters).toEqual([]);
  });

  it('puts the search in the address, keeping only what differs from the defaults', async () => {
    await create();
    searches()[0].flush(page([]));
    component.onFilterChange('project', ['PRJ-A']);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { project: ['PRJ-A'] }, replaceUrl: true }));
    component.onPage({ pageIndex: 1, pageSize: 50, length: 100 } as any);
    component.onSort({ active: 'location', direction: 'desc' });
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { project: ['PRJ-A'], pageSize: 50, sort: 'location', dir: 'desc' } }));
  });

  it('only keeps the newest answer when searches overlap', async () => {
    await create();
    const [first] = searches();
    component.onFilterChange('location', ['Meridian HQ']);
    const [second] = searches();
    // The older request is cancelled as soon as a newer one starts, so a slow old answer can never overwrite a new one.
    expect(first.cancelled).toBe(true);
    second.flush(page([row('UZ2', 'NEW')], 1));
    expect(component.result.rows[0].serial_no).toBe('NEW');
  });

  it('steps back to the last page when narrowing the search leaves fewer pages', async () => {
    await create({ page: '9' });
    searches()[0].flush(page([], 30, 9, 25));
    const [retry] = searches();
    expect(lastParams(retry).page).toBe('2');
    expect(component.query.page).toBe(2);
  });

  it('shows a retry when the search fails, keeping the filters', async () => {
    await create({ project: 'PRJ-A' });
    searches()[0].flush('boom', { status: 500, statusText: 'Server Error' });
    expect(component.loadError).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.query.project).toEqual(['PRJ-A']);
    component.reload();
    expect(component.loadError).toBe(false);
    searches()[0].flush(page([row('UZ1', 'S1')]));
    expect(component.result.total).toBe(1);
  });

  it('still searches when the filter lists cannot be loaded', async () => {
    await TestBed.configureTestingModule({
      declarations: [FATSerialNumberComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(FATSerialNumberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/serial-search/filters').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.filtersFailed).toBe(true);
    searches()[0].flush(page([row('UZ1', 'S1')]));
    expect(component.result.total).toBe(1);
  });

  it('keeps the option lists and tags the same objects between screen updates', async () => {
    await create({ project: 'PRJ-A' });
    searches()[0].flush(page([row('UZ1', 'S1')]));
    const options = component.optionLists;
    const tags = component.activeFilters;
    fixture.detectChanges();
    fixture.detectChanges();
    // A new list on every update would make the dropdowns rebuild their options forever.
    expect(component.optionLists).toBe(options);
    expect(component.activeFilters).toBe(tags);
  });

  it('filters by progress, stacked with the other filters, and shows it as a tag', async () => {
    await create({ status: 'complete' });
    const [first] = searches();
    expect(first.request.params.getAll('status')).toEqual(['complete']);
    first.flush(page([]));
    expect(component.optionLists.status.map(o => o.label)).toEqual(['Complete', 'Incomplete']);
    expect(component.activeFilters.map(f => f.group + ': ' + f.label)).toEqual(['Progress: Complete']);

    component.onFilterChange('status', ['complete', 'incomplete']);
    component.onFilterChange('location', ['Meridian HQ']);
    const last = searches().pop();
    expect(last.request.params.getAll('status')).toEqual(['complete', 'incomplete']);
    expect(last.request.params.getAll('location')).toEqual(['Meridian HQ']);
    expect(component.activeCount).toBe(3);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { location: ['Meridian HQ'], status: ['complete', 'incomplete'] } }));

    component.removeFilter(component.activeFilters.find(f => f.value === 'complete'));
    expect(component.query.status).toEqual(['incomplete']);
    // The progress choices never change with the other filters.
    expect(component.optionLists.status.length).toBe(2);
  });

  it('leaves the option lists alone when a choice is ticked, so an open dropdown is not redrawn', async () => {
    await create();
    searches()[0].flush(page([]));
    const lists = { ...component.optionLists };
    component.onFilterChange('location', ['Meridian HQ']);
    component.onFilterChange('phase', ['p1']);
    component.onFilterChange('unit_type', ['unit-z']);
    expect(component.optionLists.project).toBe(lists.project);
    expect(component.optionLists.phase).toBe(lists.phase);
    expect(component.optionLists.location).toBe(lists.location);
    expect(component.optionLists.unit_type).toBe(lists.unit_type);
    // Only a change of project reworks the phase choices.
    component.onFilterChange('project', ['PRJ-B']);
    expect(component.optionLists.phase).not.toBe(lists.phase);
    expect(component.optionLists.location).toBe(lists.location);
  });

  it('starts with the filters hidden, shows them on request, and remembers the choice', async () => {
    localStorage.removeItem('fat-deep-search-filters-open');
    await create();
    searches()[0].flush(page([]));
    fixture.detectChanges();
    expect(component.filtersOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.filters-toggle').getAttribute('aria-expanded')).toBe('false');

    component.toggleFilters();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('webproject-filter-picker').length).toBe(5);
    expect(component.filterGroups.map(g => g.title)).toEqual(['Project', 'Phase', 'Type', 'Location', 'Progress']);
    expect(fixture.nativeElement.querySelector('.filters-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem('fat-deep-search-filters-open')).toBe('1');

    component.toggleFilters();
    expect(localStorage.getItem('fat-deep-search-filters-open')).toBe('0');
    localStorage.removeItem('fat-deep-search-filters-open');
  });

  it('opens the filters again next time if they were left open', async () => {
    localStorage.setItem('fat-deep-search-filters-open', '1');
    await create();
    searches()[0].flush(page([]));
    expect(component.filtersOpen).toBe(true);
    localStorage.removeItem('fat-deep-search-filters-open');
  });

  it('shows how many filters are on, even while the row is hidden, with the tags still visible', async () => {
    localStorage.removeItem('fat-deep-search-filters-open');
    await create({ project: ['PRJ-A', 'PRJ-B'], location: 'Meridian HQ' });
    searches()[0].flush(page([row('UZ1', 'S1')]));
    fixture.detectChanges();
    expect(component.activeCount).toBe(3);
    expect(fixture.nativeElement.querySelector('.filters-badge').textContent.trim()).toBe('3');
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.filter-tag').length).toBe(3);
  });

  it('says what the filters and text found, or did not find', async () => {
    await create({ q: 'zzz', location: 'Northwind Partners' });
    searches()[0].flush(page([], 0));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No results');
    expect(text).toContain('No results match "zzz" within these filters');
    expect(text).toContain('Location: Northwind Partners');
  });
});
