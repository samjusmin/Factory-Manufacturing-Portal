import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ITrainingLocation,
  ITrainingUserRow,
  TRAINING_AREAS,
  TRAINING_AREA_LABELS,
  TrainingArea,
  TrainingOverall,
} from '@webproject/data';
import { OVERALL_LABELS, redCount, roleLabel } from '../training-view';
import { TrainingService } from '../training.service';

type RoleFilter = 'All' | 'None' | TrainingArea;
type StatusFilter = 'All' | 'attention' | 'due-soon' | 'current';

const STATE_ORDER: { [state in TrainingOverall]: number } = { 'attention': 0, 'due-soon': 1, 'current': 2, 'none': 3 };

// The people registered at one location: their roles, how much of their required training is in date, and a status.
// Opening a row shows that person's modules.
@Component({
  selector: 'webproject-training-location',
  templateUrl: './training-location.component.html',
  styleUrls: ['./training-location.component.css']
})
export class TrainingLocationComponent implements OnInit {

  readonly areaLabels = TRAINING_AREA_LABELS;
  readonly overallLabels = OVERALL_LABELS;
  readonly redCount = redCount;
  readonly roleLabel = roleLabel;
  readonly columns = ['name', 'areas', 'progress', 'state'];

  location = '';
  loaded = false;
  failed = false;
  notFound = false;
  term = '';
  roleFilter: RoleFilter = 'All';
  statusFilter: StatusFilter = 'All';

  readonly roleFilters: { value: RoleFilter, label: string }[] = [
    { value: 'All', label: 'All' },
    ...TRAINING_AREAS.map(a => ({ value: a as RoleFilter, label: TRAINING_AREA_LABELS[a] })),
    { value: 'None', label: 'No role' },
  ];
  readonly statusFilters: { value: StatusFilter, label: string }[] = [
    { value: 'All', label: 'All' },
    { value: 'attention', label: 'Needs attention' },
    { value: 'due-soon', label: 'Due soon' },
    { value: 'current', label: 'Up to date' },
  ];

  source = new MatTableDataSource<ITrainingUserRow>([]);
  // Counts beside the filter buttons, worked out when the data arrives.
  roleCounts: { [value: string]: number } = {};
  statusCounts: { [value: string]: number } = {};

  @ViewChild(MatSort) set sort(sort: MatSort) {
    this.source.sort = sort;
  }

  constructor(private training: TrainingService, private route: ActivatedRoute, private router: Router) {
    this.source.filterPredicate = (user) => this.matches(user);
    this.source.sortingDataAccessor = (user, column) => {
      switch (column) {
        case 'name': return user.name.toLowerCase();
        case 'areas': return user.areas.length;
        case 'progress': return user.state === 'none' ? -1 : user.percentCurrent;
        case 'state': return STATE_ORDER[user.state] * 1000 - redCount(user.counts);
      }
      return '';
    };
  }

  ngOnInit(): void {
    this.location = this.route.snapshot.paramMap.get('location');
    this.load();
  }

  load(): void {
    this.failed = false;
    this.training.locations().subscribe(
      (locations) => this.show(locations),
      (error) => {
        this.failed = true;
        this.loaded = true;
        if (error instanceof HttpErrorResponse && error.error && error.error.statusCode == 401) {
          throw error;
        }
      }
    );
  }

  private show(locations: ITrainingLocation[]): void {
    const entry = locations.find(l => l.location === this.location);
    this.notFound = !entry;
    const users = entry ? entry.users : [];
    this.source.data = users;
    this.roleCounts = { All: users.length, None: users.filter(u => !u.areas.length).length };
    TRAINING_AREAS.forEach(a => this.roleCounts[a] = users.filter(u => u.areas.includes(a)).length);
    this.statusCounts = { All: users.length };
    this.statusFilters.forEach(s => s.value !== 'All' && (this.statusCounts[s.value] = users.filter(u => u.state === s.value).length));
    this.loaded = true;
  }

  private matches(user: ITrainingUserRow): boolean {
    const term = this.term.trim().toLowerCase();
    if (term && !user.name.toLowerCase().includes(term) && !user.username.toLowerCase().includes(term)) {
      return false;
    }
    if (this.roleFilter === 'None' ? user.areas.length > 0 : this.roleFilter !== 'All' && !user.areas.includes(this.roleFilter)) {
      return false;
    }
    return this.statusFilter === 'All' || user.state === this.statusFilter;
  }

  private refilter(): void {
    // The table only re-runs its filter when this value changes.
    this.source.filter = [this.term, this.roleFilter, this.statusFilter].join('|');
  }

  setTerm(term: string): void {
    this.term = term;
    this.refilter();
  }

  setRole(value: RoleFilter): void {
    this.roleFilter = value;
    this.refilter();
  }

  setStatus(value: StatusFilter): void {
    this.statusFilter = value;
    this.refilter();
  }

  open(user: ITrainingUserRow): void {
    this.router.navigate(['/train-reg', this.location, user.username]);
  }

  goBack(): void {
    this.router.navigate(['/train-reg']);
  }

  trackByUsername(index: number, user: ITrainingUserRow): string {
    return user.username;
  }
}
