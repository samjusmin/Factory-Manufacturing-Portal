import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { EMPTY, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import {
  ISerialSearchFilters,
  ISerialSearchQuery,
  ISerialSearchResult,
  ISerialSearchRow,
  SERIAL_SEARCH_DEFAULT_PAGE_SIZE,
  SERIAL_SEARCH_FILTER_KEYS,
  SERIAL_SEARCH_PAGE_SIZES,
  SerialSearchFilterKey,
  SerialSearchSort,
  parseSerialSearchQuery
} from '@webproject/data';
import { FATProjectService } from '../fat-project.service';
import { unitTypeName } from '../fat-options';
import { FilterOption } from '../filter-picker/filter-picker.component';

const FILTERS_OPEN_KEY = 'fat-deep-search-filters-open';

// The progress filter's two choices. A unit is complete at 100%.
const STATUS_OPTIONS: FilterOption[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'incomplete', label: 'Incomplete' },
];

// A filter that is switched on, shown as a removable tag above the results.
export interface ActiveFilter {
  key: SerialSearchFilterKey;
  value: string;
  group: string;
  label: string;
}

@Component({
  selector: 'webproject-fat-serial-lookup',
  templateUrl: './fat-serial-lookup.component.html',
  styleUrls: ['./fat-serial-lookup.component.css']
})

// Deep Search. Filtering, searching, sorting and paging all happen on the server, so only the page on screen is ever
// loaded, however many units there are. The state lives in the address, so a search can be bookmarked or shared, and
// the back button works.
export class FATSerialNumberComponent implements OnInit, OnDestroy {

  readonly pageSizes = SERIAL_SEARCH_PAGE_SIZES;
  readonly columns = [
    { name: 'doc_no', title: 'PC' },
    { name: 'unit_no', title: 'Unit' },
    { name: 'serial_no', title: 'Serial No.' },
    { name: 'project', title: 'Project' },
    { name: 'phase_name', title: 'Phase' },
    { name: 'unit_type', title: 'Type' },
    { name: 'location', title: 'Location' },
    { name: 'progress', title: 'Progress' },
  ];
  readonly displayedColumns = this.columns.map(c => c.name);
  readonly filterGroups: Array<{ key: SerialSearchFilterKey, title: string }> = [
    { key: 'project', title: 'Project' },
    { key: 'phase', title: 'Phase' },
    { key: 'unit_type', title: 'Type' },
    { key: 'location', title: 'Location' },
    { key: 'status', title: 'Progress' },
  ];

  query: ISerialSearchQuery = parseSerialSearchQuery({});
  filters: ISerialSearchFilters | null = null;
  // What the filter boxes offer and the tags show. They are worked out when something changes, not on every screen
  // update: a new list each time would make the dropdowns rebuild their options endlessly.
  optionLists: { [key: string]: FilterOption[] } = { project: [], phase: [], unit_type: [], location: [], status: STATUS_OPTIONS };
  activeFilters: ActiveFilter[] = [];
  filtersFailed = false;
  result: ISerialSearchResult | null = null;
  loading = false;
  loadError = false;
  // Whether the row of filters is showing. It starts hidden, and the choice is remembered for next time.
  filtersOpen = false;

  // A search is made whenever `request$` fires; only the latest one counts (an older answer arriving late is dropped).
  private request$ = new Subject<void>();
  // Typing waits for a short pause before searching, so a fast typist does not send a request per key.
  private typing$ = new Subject<void>();
  private subs = new Subscription();

  constructor(
    public FATProjectService: FATProjectService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    FATProjectService.showError = false;
  }

  ngOnInit(): void {
    this.FATProjectService.checkIfAdmin();
    this.query = parseSerialSearchQuery(this.route.snapshot.queryParams);
    this.filtersOpen = this.readFiltersOpen();
    this.rebuild();

    this.subs.add(this.request$.pipe(
      switchMap(() => {
        this.loading = true;
        this.loadError = false;
        return this.FATProjectService.searchSerials(this.query).pipe(
          catchError(error => {
            console.error(error);
            this.loading = false;
            this.loadError = true;
            return EMPTY;
          })
        );
      })
    ).subscribe(result => this.received(result)));
    this.subs.add(this.typing$.pipe(debounceTime(300)).subscribe(() => this.refresh()));

    this.loadFilters();
    this.request$.next();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadFilters() {
    this.filtersFailed = false;
    this.FATProjectService.getSerialSearchFilters().subscribe(
      (filters) => {
        this.filters = filters;
        this.rebuild();
      },
      (error) => {
        // The search still works without the lists; the filter boxes just stay empty.
        console.error(error);
        this.filtersFailed = true;
      }
    );
  }

  // ---------- showing and hiding the filters ----------

  toggleFilters() {
    this.filtersOpen = !this.filtersOpen;
    try {
      localStorage.setItem(FILTERS_OPEN_KEY, this.filtersOpen ? '1' : '0');
    } catch (e) {
      // Remembering the choice is a nicety; the page works without it.
    }
  }

  private readFiltersOpen(): boolean {
    try {
      return localStorage.getItem(FILTERS_OPEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  // How many individual choices are switched on across all the filters (the number on the Filters button).
  get activeCount(): number {
    return this.activeFilters.length;
  }

  // ---------- results ----------

  private received(result: ISerialSearchResult) {
    this.loading = false;
    // Narrowing the search can leave fewer pages than the one asked for: step back to the last one.
    const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
    if (!result.rows.length && result.total > 0 && this.query.page > lastPage) {
      this.query.page = lastPage;
      this.refresh(false);
      return;
    }
    this.result = result;
  }

  reload() {
    this.request$.next();
  }

  // Puts the current search in the address, then asks for it.
  refresh(resetPage = true) {
    if (resetPage) {
      this.query.page = 1;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: this.toParams(), replaceUrl: true });
    this.request$.next();
  }

  // Only what differs from the defaults goes into the address, to keep it short.
  private toParams(): { [key: string]: any } {
    const q = this.query;
    const params: { [key: string]: any } = {};
    if (q.q) { params.q = q.q; }
    SERIAL_SEARCH_FILTER_KEYS.forEach(key => { if (q[key].length) { params[key] = q[key]; } });
    if (q.page > 1) { params.page = q.page; }
    if (q.pageSize !== SERIAL_SEARCH_DEFAULT_PAGE_SIZE) { params.pageSize = q.pageSize; }
    if (q.sort !== 'doc_no') { params.sort = q.sort; }
    if (q.dir !== 'asc') { params.dir = q.dir; }
    return params;
  }

  // ---------- searching, filtering, sorting and paging ----------

  onSearchInput(text: string) {
    this.query.q = (text || '').trim();
    this.typing$.next();
  }

  onFilterChange(key: SerialSearchFilterKey, values: string[]) {
    this.query[key] = values || [];
    if (key === 'project') {
      // A phase belongs to one project, so picking projects drops any chosen phase from the others.
      const allowed = new Set(this.phaseOptions.map(p => p.id));
      this.query.phase = this.query.phase.filter(id => allowed.has(id));
    }
    // Only the Phase choices depend on another filter (the projects); the other lists stay as they are, so the
    // dropdowns are not redrawn while someone is ticking boxes in them.
    if (key === 'project') {
      this.rebuildPhaseOptions();
    }
    this.rebuildTags();
    this.refresh();
  }

  removeFilter(filter: ActiveFilter) {
    this.onFilterChange(filter.key, this.query[filter.key].filter(v => v !== filter.value));
  }

  clearFilters() {
    SERIAL_SEARCH_FILTER_KEYS.forEach(key => this.query[key] = []);
    this.rebuildPhaseOptions();
    this.rebuildTags();
    this.refresh();
  }

  onSort(sort: Sort) {
    this.query.sort = (sort.direction ? sort.active : 'doc_no') as SerialSearchSort;
    this.query.dir = sort.direction === 'desc' ? 'desc' : 'asc';
    this.refresh();
  }

  onPage(event: PageEvent) {
    const sizeChanged = event.pageSize !== this.query.pageSize;
    this.query.pageSize = event.pageSize;
    this.query.page = sizeChanged ? 1 : event.pageIndex + 1;
    this.refresh(false);
  }

  // ---------- what the filter boxes and tags show ----------

  // Phases the Phase filter offers: only those of the chosen projects when any are chosen.
  get phaseOptions(): Array<{ id: string, name: string, project: string }> {
    const phases = this.filters ? this.filters.phases : [];
    return this.query.project.length ? phases.filter(p => this.query.project.indexOf(p.project) > -1) : phases;
  }

  // Works out all the option lists and the tags from the current filters.
  private rebuild() {
    const f = this.filters;
    this.optionLists = {
      project: f ? f.projects.map(value => ({ value, label: value })) : [],
      phase: this.phaseChoices(),
      unit_type: f ? f.unit_types.map(value => ({ value, label: unitTypeName(value) })) : [],
      location: f ? f.locations.map(value => ({ value, label: value })) : [],
      status: STATUS_OPTIONS,
    };
    this.rebuildTags();
  }

  private phaseChoices(): FilterOption[] {
    return this.phaseOptions.map(p => ({ value: p.id, label: p.name, hint: this.query.project.length === 1 ? undefined : p.project }));
  }

  private rebuildPhaseOptions() {
    this.optionLists = { ...this.optionLists, phase: this.phaseChoices() };
  }

  private rebuildTags() {
    const tags: ActiveFilter[] = [];
    this.filterGroups.forEach(group => this.query[group.key].forEach(value =>
      tags.push({ key: group.key, value, group: group.title, label: this.labelFor(group.key, value) })));
    this.activeFilters = tags;
  }

  trackTag(index: number, tag: ActiveFilter) {
    return tag.key + '|' + tag.value;
  }

  labelFor(key: SerialSearchFilterKey, value: string): string {
    if (key === 'unit_type') {
      return unitTypeName(value);
    }
    if (key === 'status') {
      const option = STATUS_OPTIONS.find(o => o.value === value);
      return option ? option.label : value;
    }
    if (key === 'phase' && this.filters) {
      const phase = this.filters.phases.find(p => p.id === value);
      return phase ? phase.name : value;
    }
    return value;
  }

  get hasFilters(): boolean {
    return SERIAL_SEARCH_FILTER_KEYS.some(key => this.query[key].length > 0);
  }

  get rangeText(): string {
    if (!this.result || !this.result.total) {
      return '';
    }
    const from = (this.result.page - 1) * this.result.pageSize + 1;
    const to = Math.min(this.result.total, this.result.page * this.result.pageSize);
    return 'Showing ' + from + '-' + to + ' of ' + this.result.total + (this.result.total === 1 ? ' result' : ' results');
  }

  trackRow(index: number, row: ISerialSearchRow) {
    return row.doc_no + '|' + row.serial_no;
  }

  typeName(value: string): string {
    return unitTypeName(value);
  }
}
