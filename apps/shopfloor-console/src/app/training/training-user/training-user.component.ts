import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ITrainingModuleRow,
  ITrainingUserDetail,
  TRAINING_AREAS,
  TRAINING_AREA_LABELS,
  TRAINING_VALIDITY_YEARS,
  TrainingArea,
  localIsoDate,
} from '@webproject/data';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';
import { OVERALL_LABELS, STATE_LABELS, formatDate, redCount, roleLabel, timeLeftText } from '../training-view';
import { TrainingService } from '../training.service';

// One person's training: the roles they hold and, for each role, every module it requires with when it was done,
// when it renews and whether it is in date. Expired and not-done modules are red, ones renewing soon are amber.
@Component({
  selector: 'webproject-training-user',
  templateUrl: './training-user.component.html',
  styleUrls: ['./training-user.component.css']
})
export class TrainingUserComponent implements OnInit {

  readonly areaLabels = TRAINING_AREA_LABELS;
  readonly allAreas = TRAINING_AREAS;
  readonly stateLabels = STATE_LABELS;
  readonly overallLabels = OVERALL_LABELS;
  readonly validityYears = TRAINING_VALIDITY_YEARS;
  readonly formatDate = formatDate;
  readonly timeLeftText = timeLeftText;
  readonly redCount = redCount;
  readonly roleLabel = roleLabel;

  location = '';
  username = '';
  detail: ITrainingUserDetail | null = null;
  loaded = false;
  failed = false;
  notFound = false;
  saving = false;
  // The latest day a completion can be recorded for (today).
  today = localIsoDate();

  // The module being given a completion date, and the date typed so far.
  recording: string | null = null;
  recordDate = '';

  // The roles being edited, or null when the roles panel is closed.
  editingAreas: TrainingArea[] | null = null;

  constructor(
    private training: TrainingService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) { }

  ngOnInit(): void {
    this.location = this.route.snapshot.paramMap.get('location');
    this.username = this.route.snapshot.paramMap.get('username');
    this.load();
  }

  load(): void {
    this.failed = false;
    this.training.user(this.username).subscribe(
      (detail) => {
        this.detail = detail;
        this.loaded = true;
      },
      (error) => {
        this.loaded = true;
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.notFound = true;
        } else {
          this.failed = true;
        }
        if (error instanceof HttpErrorResponse && error.error && error.error.statusCode == 401) {
          throw error;
        }
      }
    );
  }

  goBack(): void {
    this.router.navigate(['/train-reg', this.location]);
  }

  // ---------- recording a completion ----------

  startRecording(row: ITrainingModuleRow): void {
    this.recording = row.module;
    // Start from the date already recorded (to correct it), or today.
    this.recordDate = row.status.completedOn || this.today;
  }

  cancelRecording(): void {
    this.recording = null;
  }

  get recordDateValid(): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(this.recordDate) && this.recordDate <= this.today;
  }

  saveRecording(): void {
    if (!this.recording || !this.recordDateValid || this.saving) {
      return;
    }
    const module = this.recording;
    const date = this.recordDate;
    this.change(this.training.record(this.username, module, date),
      `${module} recorded as completed on ${formatDate(date)}.`, () => this.recording = null);
  }

  clear(row: ITrainingModuleRow): void {
    this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Clear completion',
        message: `Remove the completion of ${row.module} (${formatDate(row.status.completedOn)})? It will count as not done until it is recorded again.`,
        confirmLabel: 'Clear',
      }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.change(this.training.clear(this.username, row.module), `${row.module} cleared.`);
      }
    });
  }

  // ---------- roles ----------

  startEditingAreas(): void {
    this.editingAreas = this.detail ? this.detail.areas.slice() : [];
  }

  cancelEditingAreas(): void {
    this.editingAreas = null;
  }

  toggleArea(area: TrainingArea, checked: boolean): void {
    const current = this.editingAreas || [];
    this.editingAreas = this.allAreas.filter(a => a === area ? checked : current.includes(a));
  }

  get areasChanged(): boolean {
    return !!this.detail && !!this.editingAreas &&
      this.editingAreas.join(',') !== this.detail.areas.join(',');
  }

  saveAreas(): void {
    if (!this.editingAreas || this.saving) {
      return;
    }
    this.change(this.training.setAreas(this.username, this.editingAreas),
      'Roles saved. The change to what they can open takes effect when they next sign in.', () => this.editingAreas = null);
  }

  // Runs a change, shows the updated person, and says what happened.
  private change(request: import('rxjs').Observable<ITrainingUserDetail>, message: string, done?: () => void): void {
    this.saving = true;
    request.subscribe(
      (detail) => {
        this.detail = detail;
        this.saving = false;
        if (done) {
          done();
        }
        this.snackBar.open(message, 'OK', { duration: 6000 });
      },
      (error) => {
        this.saving = false;
        if (error instanceof HttpErrorResponse && error.error && error.error.statusCode == 401) {
          throw error;
        }
        const reason = error instanceof HttpErrorResponse && error.status === 400 && error.error && error.error.message;
        this.snackBar.open(reason ? String(reason) : 'That change could not be saved. Please try again.', 'OK', { duration: 8000 });
      }
    );
  }

  trackByModule(index: number, row: ITrainingModuleRow): string {
    return row.module;
  }

  trackByArea(index: number, area: { area: string }): string {
    return area.area;
  }
}
