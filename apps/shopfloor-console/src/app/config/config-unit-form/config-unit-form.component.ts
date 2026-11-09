import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  ConfigUnit,
  IConfigCategory,
  IConfigCheck,
  STOCK_PROJECT,
  checkRows,
  isCheckDone,
  locationProjects,
} from '@webproject/data';
import { ConfigService } from '../config.service';
import { progressState, errorMessage } from '../config-view';
import { ChecklistConflict, checkSnapshot, mergeChecklist } from '../../fat/fat-checklist-merge';
import { HasUnsavedChanges } from '../../fat/unsaved-changes.guard';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';
import { MatSnackBar } from '@angular/material/snack-bar';

// A heading row and the checks under it (the first group has no heading when a list starts with checks).
export interface UnitChecklistSection {
  heading: IConfigCheck | null;
  rows: IConfigCheck[];
}

// The message the server gives when someone else saved the unit after this copy was loaded.
const CHANGED_BY_SOMEONE = 'This unit was changed by someone else.';

const notBlank = (control: AbstractControl): ValidationErrors | null =>
  String(control.value || '').trim() ? null : { required: true };

// One unit: its details at the top (serial no., model, image, project and parts) and its checklist below, laid out like
// the FAT checklist. The same page adds a new unit and opens an existing one.
@Component({
  selector: 'webproject-config-unit-form',
  templateUrl: './config-unit-form.component.html'
})
export class ConfigUnitFormComponent implements OnInit, OnDestroy, HasUnsavedChanges {

  // The three answers for a check. Each has an icon as well as text, so the state never depends on colour alone.
  readonly statusOptions = [
    { value: 'Complete', label: 'Complete', icon: 'check', css: 'complete' },
    { value: 'Incomplete', label: 'Incomplete', icon: 'times', css: 'incomplete' },
    { value: 'N/A', label: 'N/A', icon: null, css: 'na' },
  ];

  readonly progressState = progressState;
  readonly stock = STOCK_PROJECT;

  location = '';
  categoryName = '';
  type = '';
  id = '';

  category: IConfigCategory | null = null;
  loaded = false;
  loadMessage = '';

  // What the user may pick from at this location.
  models: string[] = [];
  // The models shown for this unit: the location's, and the unit's own if the location no longer lists it.
  modelOptions: string[] = [];
  images: string[] = [];
  projects: string[] = [STOCK_PROJECT];

  form: FormGroup | null = null;
  // The serial no. as last saved, for the page title.
  savedSerial = '';

  rows: IConfigCheck[] = [];
  version = 0;
  progress = 0;

  // Where the save is: '' (nothing happening), 'saving', 'saved' or 'failed'.
  saveState: '' | 'saving' | 'saved' | 'failed' = '';
  private savedTimer: any;

  // What each row looked like when it was loaded (by position), to tell which rows the user has changed.
  private baseline: string[] = [];

  // When someone else saved this unit first: a note saying what happened, and the rows that both of you changed, which
  // the user settles one by one before saving.
  mergeNotice = '';
  conflicts: ChecklistConflict<IConfigCheck>[] = [];
  private resolved = new Set<ChecklistConflict<IConfigCheck>>();

  private routeSub: Subscription;

  constructor(
    public ConfigService: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // The page follows its address, but adding a unit moves it to the new unit's address, which is not a reload.
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      if (this.loaded && id === this.id) {
        return;
      }
      this.location = params.get('location') || '';
      this.categoryName = params.get('category') || '';
      this.type = params.get('type') || '';
      this.id = id;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    clearTimeout(this.savedTimer);
  }

  get isNew(): boolean {
    return this.id === 'add-unit';
  }

  get title(): string {
    return this.isNew ? `New ${this.type}` : (this.savedSerial || this.type);
  }

  // ---------- loading ----------

  load(): void {
    this.loaded = false;
    this.loadMessage = '';
    this.ConfigService.getCatalogue().pipe(
      switchMap(catalogue => {
        const category = catalogue.categories.find(c => c.name === this.categoryName);
        if (!category) {
          throw { status: 404, error: { message: `There is no category called "${this.categoryName}".` } };
        }
        return forkJoin({
          category: of(category),
          location: this.ConfigService.getLocation(this.location),
          template: this.isNew ? this.ConfigService.getCatalogueType(this.type) : of(null),
          unit: this.isNew ? of(null) : this.ConfigService.getUnit(this.id),
          models: this.ConfigService.getAccessibleHardware(this.location, this.categoryName),
          images: category.uses_image ? this.ConfigService.getAccessibleImages(this.location, this.type) : of([]),
        });
      })
    ).subscribe(
      ({ category, location, template, unit, models, images }) => {
        this.category = category;
        this.models = models.map(m => m.name);
        this.images = images.map(i => i.name);
        this.projects = locationProjects(location && location.projects);
        const rows = unit ? unit.checklist : template.checklist.map(row => ({ ...row, status: null, checked_by: null, date_checked: null, comment: null }));
        this.show(unit, rows);
        this.loaded = true;
      },
      (error) => {
        if (error && error.status === 401) {
          throw error;
        }
        this.loadMessage = errorMessage(error, 'This unit could not be loaded.');
        this.loaded = true;
      }
    );
  }

  // Shows a unit (or a new one, with the type's checklist) as the saved state: nothing changed yet.
  private show(unit: ConfigUnit | null, rows: IConfigCheck[]) {
    this.rows = (rows || []).map(row => ({ ...row }));
    this.baseline = this.rows.map(row => checkSnapshot(row));
    this.version = (unit && unit.version) || 0;
    this.progress = (unit && unit.progress) || 0;
    this.savedSerial = (unit && unit.serial_no) || '';
    this.buildForm(unit);
    this.sectionSource = null;
    this.conflicts = [];
    this.resolved.clear();
  }

  // The model of a new unit is filled in when the location has only one for this category.
  private buildForm(unit: ConfigUnit | null) {
    this.modelOptions = this.modelChoices(unit);
    const model = unit ? unit.model : (this.modelOptions.length === 1 ? this.modelOptions[0] : null);
    const partSerial = (name: string) => ((unit && unit.parts) || []).find(p => p.name === name)?.serial_no || '';
    this.form = this.fb.group({
      serial_no: [(unit && unit.serial_no) || '', [notBlank]],
      device_name: [(unit && unit.device_name) || ''],
      model: [model || '', this.modelOptions.length > 1 ? [Validators.required] : []],
      pc_image: [(unit && unit.pc_image) || ''],
      project: [(unit && unit.project) || STOCK_PROJECT],
      parts: this.fb.array(((this.category && this.category.parts) || []).map(name => new FormControl(partSerial(name)))),
    });
  }

  // The models to choose from: the location's, and the unit's own if the location no longer lists it.
  modelChoices(unit: ConfigUnit | null): string[] {
    const own = unit && unit.model;
    return own && !this.models.includes(own) ? [...this.models, own] : this.models;
  }

  get imageChoices(): string[] {
    const own = this.form && this.form.value.pc_image;
    return own && !this.images.includes(own) ? [...this.images, own] : this.images;
  }

  get projectChoices(): string[] {
    const own = this.form && this.form.value.project;
    return own && !this.projects.includes(own) ? [...this.projects, own] : this.projects;
  }

  get partControls(): FormControl[] {
    return this.form ? (this.form.get('parts') as FormArray).controls as FormControl[] : [];
  }

  fieldInvalid(name: string): boolean {
    const control = this.form && this.form.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // ---------- the checklist ----------

  isCheck(row: IConfigCheck): boolean {
    return row.reference !== 'Heading';
  }

  // Rows the user has edited since the list was loaded or last saved.
  get changedRows(): IConfigCheck[] {
    return this.rows.filter((row, i) => this.isCheck(row) && this.baseline[i] !== checkSnapshot(row));
  }

  isChanged(row: IConfigCheck): boolean {
    return this.isCheck(row) && this.baseline[this.rows.indexOf(row)] !== checkSnapshot(row);
  }

  get checkList(): IConfigCheck[] {
    return checkRows(this.rows);
  }

  get doneCount(): number {
    return this.checkList.filter(isCheckDone).length;
  }

  get donePercent(): number {
    const total = this.checkList.length;
    return total ? Math.round((this.doneCount / total) * 100) : 0;
  }

  // The checks grouped under their headings, rebuilt only when a new list arrives (not on every keystroke).
  private sectionSource: IConfigCheck[] | null = null;
  private sectionCache: UnitChecklistSection[] = [];

  get sections(): UnitChecklistSection[] {
    if (this.rows !== this.sectionSource) {
      this.sectionSource = this.rows;
      const sections: UnitChecklistSection[] = [];
      let current: UnitChecklistSection | null = null;
      this.rows.forEach(row => {
        if (!this.isCheck(row)) {
          current = { heading: row, rows: [] };
          sections.push(current);
        } else {
          if (!current) {
            current = { heading: null, rows: [] };
            sections.push(current);
          }
          current.rows.push(row);
        }
      });
      this.sectionCache = sections;
    }
    return this.sectionCache;
  }

  trackSection(index: number) {
    return index;
  }

  trackRow(index: number, row: IConfigCheck) {
    return row;
  }

  // Checks nobody has answered yet; an explicit Incomplete or N/A is never overwritten by a bulk action.
  unchecked(rows: IConfigCheck[]): IConfigCheck[] {
    return rows.filter(row => !row.status);
  }

  get allUnchecked(): IConfigCheck[] {
    return this.unchecked(this.checkList);
  }

  // Clicking an answer selects it; clicking the answer that is already selected takes it back (the check becomes
  // unanswered again). A radio button does not do this itself, as clicking a chosen one changes nothing.
  chooseStatus(row: IConfigCheck, value: string, event?: Event) {
    if (row.status === value) {
      row.status = null;
      const input = event && event.target as HTMLInputElement;
      if (input) {
        // Untick the button once the browser has finished handling the click, which would otherwise leave it ticked.
        setTimeout(() => input.checked = false);
      }
    } else {
      row.status = value;
    }
  }

  // Marks every unanswered check in the given rows Complete, after confirming. Nothing is saved until Save is pressed.
  markComplete(rows: IConfigCheck[], where: string) {
    const targets = this.unchecked(rows);
    if (!targets.length) {
      return;
    }
    this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Mark checks complete?',
        message: 'Mark ' + targets.length + ' unchecked ' + (targets.length === 1 ? 'check' : 'checks') + ' in ' + where +
          ' as Complete? You can still change them before saving.',
        confirmLabel: 'Mark complete',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        targets.forEach(row => row.status = 'Complete');
      }
    });
  }

  // ---------- when someone else saved first ----------

  // The row a conflict is about, if this is one that still needs settling.
  conflictFor(row: IConfigCheck): ChecklistConflict<IConfigCheck> | null {
    const conflict = this.conflicts.find(c => c.mine === row);
    return conflict && !this.resolved.has(conflict) ? conflict : null;
  }

  get unresolvedCount(): number {
    return this.conflicts.filter(c => !this.resolved.has(c)).length;
  }

  keepMine(conflict: ChecklistConflict<IConfigCheck>) {
    this.resolved.add(conflict);
  }

  useTheirs(conflict: ChecklistConflict<IConfigCheck>) {
    const row = conflict.mine;
    const theirs = conflict.theirs;
    row.status = theirs.status;
    row.comment = theirs.comment;
    row.checked_by = theirs.checked_by;
    row.date_checked = theirs.date_checked;
    this.resolved.add(conflict);
  }

  dismissNotice() {
    this.mergeNotice = '';
  }

  // The server refused the save because someone else saved this unit first. Fetch what they saved and merge it with
  // the user's edits; nothing is saved until the user presses Save again.
  private handleConflict() {
    this.saveState = '';
    this.ConfigService.getUnit(this.id).subscribe(
      (theirs) => {
        const theirRows = theirs.checklist || [];
        const merged = mergeChecklist(this.baseline, this.rows, theirRows);
        const detailsDirty = !!this.form && this.form.dirty;
        const mine = this.form ? this.form.getRawValue() : null;
        if (!merged) {
          // The checklist itself changed shape, so the edits cannot be lined up with it.
          this.show(theirs, theirRows);
          this.mergeNotice = 'Someone else changed this unit, and your edits could not be kept. It has been reloaded.';
          return;
        }
        const baseline = theirRows.map(row => checkSnapshot(row));
        this.rows = merged.rows;
        this.baseline = baseline;
        this.version = theirs.version || 0;
        this.progress = theirs.progress || 0;
        this.savedSerial = theirs.serial_no;
        this.sectionSource = null;
        this.resolved.clear();
        this.conflicts = merged.conflicts;
        // The details: theirs, unless the user has been editing them (then those are kept).
        this.buildForm(theirs);
        if (detailsDirty && this.form && mine) {
          this.form.patchValue(mine);
          this.form.markAsDirty();
        }
        const parts = ['Someone else saved this unit while you were working.'];
        if (merged.fromOthers) {
          parts.push(merged.fromOthers + (merged.fromOthers === 1 ? ' check now shows their change.' : ' checks now show their changes.'));
        }
        if (detailsDirty) {
          parts.push('Your changes to the details are kept.');
        }
        if (merged.yours) {
          parts.push('Your changes to the checks are kept.');
        }
        parts.push(merged.yours || detailsDirty ? 'Review them, then save.' : 'You had nothing else to save.');
        this.mergeNotice = parts.join(' ');
      },
      (error) => {
        this.saveState = 'failed';
        throw error;
      }
    );
  }

  // ---------- saving ----------

  hasUnsavedChanges(): boolean {
    return (!!this.form && this.form.dirty) || this.changedRows.length > 0;
  }

  // Closing or reloading the tab with unsaved edits.
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: any) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // A new unit needs its serial no.; after that, save needs something to save, nothing already being saved, and any
  // clash with someone else's changes settled.
  get canSave(): boolean {
    return this.saveState !== 'saving' && this.unresolvedCount === 0 && (this.isNew || this.hasUnsavedChanges());
  }

  // What the details part of the form holds, as the server takes it.
  private details() {
    const value = this.form.getRawValue();
    return {
      serial_no: String(value.serial_no || '').trim(),
      device_name: value.device_name,
      model: value.model || null,
      pc_image: this.category && this.category.uses_image ? (value.pc_image || null) : null,
      project: value.project,
      parts: ((this.category && this.category.parts) || []).map((name, i) => ({ name, serial_no: value.parts[i] })),
    };
  }

  saveChanges() {
    if (!this.form || !this.canSave) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.snackBar.open('Check the fields marked in red.', 'OK', { duration: 6000 });
      return;
    }
    clearTimeout(this.savedTimer);
    this.saveState = 'saving';
    const changes = this.rows
      .map((row, index) => ({ index, status: row.status || null, comment: row.comment || null }))
      .filter((change, i) => this.isCheck(this.rows[i]) && this.baseline[i] !== checkSnapshot(this.rows[i]));

    const request = this.isNew
      ? this.ConfigService.createUnit({ location: this.location, hardware_category: this.categoryName, hardware_type: this.type, ...this.details(), changes })
      : this.ConfigService.updateUnit({ id: this.id, version: this.version, ...this.details(), changes });

    request.subscribe(
      (unit) => this.saved(unit),
      (error) => this.failed(error)
    );
  }

  private saved(unit: ConfigUnit) {
    const wasNew = this.isNew;
    this.show(unit, unit.checklist || []);
    this.mergeNotice = '';
    this.saveState = 'saved';
    this.savedTimer = setTimeout(() => this.saveState = '', 4000);
    if (wasNew) {
      // The unit now has an address: move there, so a further save updates it instead of adding another.
      this.id = unit._id;
      this.router.navigate(['/config-hardware-checklist', this.location, this.categoryName, this.type, unit._id], { replaceUrl: true });
    }
  }

  private failed(error: any) {
    if (error && error.status === 401) {
      this.saveState = 'failed';
      throw error;
    }
    const message = errorMessage(error, '');
    if (error && error.status === 409 && message === CHANGED_BY_SOMEONE) {
      // Someone else saved this unit first: show what they saved, with the user's edits kept on top.
      this.handleConflict();
      return;
    }
    if (error && error.status === 409 && this.form) {
      // The serial no. belongs to another unit: say so beside the field.
      this.form.get('serial_no').setErrors({ taken: message });
      this.form.get('serial_no').markAsTouched();
      this.saveState = '';
      return;
    }
    // Keep the user's edits on screen so they can try again.
    this.saveState = 'failed';
    this.snackBar.open(message || 'That could not be saved. Please try again.', 'OK', { duration: 8000 });
  }
}
