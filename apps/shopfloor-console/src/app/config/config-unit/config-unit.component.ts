import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfigUnit, STOCK_PROJECT, locationProjects } from '@webproject/data';
import { ConfigService } from '../config.service';
import {
  IUnitColumn,
  PROGRESS_FILTERS,
  ProgressFilter,
  matchesProgress,
  matchesTerm,
  progressState,
  projectFilters,
  unitColumns,
  unitSearchText,
} from '../config-view';

// The units of one hardware type at a location: what each is, which project it is allocated to and how far its
// checklist is. The serial no. identifies a unit and opens its checklist.
@Component({
  selector: 'webproject-config-unit',
  templateUrl: './config-unit.component.html'
})

export class ConfigUnitComponent implements OnInit, OnDestroy {

  location = '';
  category = '';
  type = '';
  columns: IUnitColumn[] = [];
  displayedColumns: string[] = [];
  term = '';
  private routeSub: Subscription;
  progressFilter: ProgressFilter = 'All';
  // 'All', or the project the list is narrowed to.
  projectFilter = 'All';
  // The project codes of the location (STOCK first).
  projects: string[] = [STOCK_PROJECT];

  readonly progressFilters = PROGRESS_FILTERS;
  readonly progressState = progressState;
  readonly stock = STOCK_PROJECT;

  // The table's data lives in the service, so it is filled in place and the sorting stays attached.
  readonly source = this.ConfigService.hardwareUnitsDatasource;

  private countsFor: ConfigUnit[] | null = null;
  private cachedCounts: { [filter: string]: number } = {};
  private projectsFor: ConfigUnit[] | null = null;
  private cachedProjects: string[] = ['All'];

  @ViewChild(MatSort) set sort(sort: MatSort) {
    this.source.sort = sort;
  }

  constructor(
    public ConfigService: ConfigService,
    private route: ActivatedRoute,
  ) {
    this.source.filterPredicate = (unit) => this.matches(unit);
    this.source.sortingDataAccessor = (unit, column) => {
      switch (column) {
        case 'progress':
        case 'state':
          return Number(unit.progress) || 0;
        case 'parts':
          return (unit.parts || []).length;
        default: {
          const value = unit[column];
          return String(value == null ? '' : value).toLowerCase();
        }
      }
    };
  }

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    // The page is reused when only the type or category in the address changes, so it follows the address.
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.location = params.get('location') || '';
      this.category = params.get('category') || '';
      this.type = params.get('type') || '';
      this.term = '';
      this.progressFilter = 'All';
      this.projectFilter = 'All';
      this.setColumns();
      this.refilter();
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  load(): void {
    this.ConfigService.getHardwareUnits(this.location, this.category, this.type);
    // The columns depend on the category's definition, and the project filter on the location's projects.
    this.ConfigService.getCatalogue().subscribe(() => this.setColumns());
    this.ConfigService.getLocation(this.location).subscribe(location => {
      this.projects = locationProjects(location && location.projects);
      // The units can arrive first, so the filters may have been worked out without these projects.
      this.projectsFor = null;
    });
  }

  // The columns this category shows: the image only where units have one, the parts only where they have some.
  private setColumns(): void {
    this.columns = unitColumns(this.ConfigService.category(this.category));
    this.displayedColumns = this.columns.map(c => c.name);
  }

  getLocation(): string {
    return this.location;
  }

  getCategory(): string {
    return this.category;
  }

  getType(): string {
    return this.type;
  }

  // The number beside each progress filter, worked out when the units arrive.
  get counts(): { [filter: string]: number } {
    const units = this.source.data;
    if (this.countsFor !== units) {
      this.countsFor = units;
      this.cachedCounts = { All: units.length };
      this.progressFilters.forEach(f => f !== 'All' && (this.cachedCounts[f] = units.filter(u => matchesProgress(u.progress, f)).length));
    }
    return this.cachedCounts;
  }

  // The project filters: All, STOCK, and each project of the location that has units here.
  get projectChoices(): string[] {
    const units = this.source.data;
    if (this.projectsFor !== units) {
      this.projectsFor = units;
      this.cachedProjects = projectFilters(this.projects, units);
    }
    return this.cachedProjects;
  }

  projectCount(project: string): number {
    return project === 'All' ? this.source.data.length : this.source.data.filter(u => u.project === project).length;
  }

  private matches(unit: ConfigUnit): boolean {
    return matchesProgress(unit.progress, this.progressFilter)
      && (this.projectFilter === 'All' || unit.project === this.projectFilter)
      && matchesTerm(unitSearchText(unit, this.columns), this.term);
  }

  private refilter(): void {
    // The table only re-runs its filter when this value changes.
    this.source.filter = [this.term, this.progressFilter, this.projectFilter].join('|');
  }

  setTerm(term: string): void {
    this.term = term;
    this.refilter();
  }

  setProgress(filter: ProgressFilter): void {
    this.progressFilter = filter;
    this.refilter();
  }

  setProject(project: string): void {
    this.projectFilter = project;
    this.refilter();
  }

  // The tooltip on a unit's parts: each part with its serial no.
  partsTitle(unit: ConfigUnit): string {
    return (unit.parts || []).map(p => p.name + ': ' + (p.serial_no || '–')).join('\n');
  }

  trackById(index: number, unit: ConfigUnit): string {
    return unit._id || String(index);
  }
}
