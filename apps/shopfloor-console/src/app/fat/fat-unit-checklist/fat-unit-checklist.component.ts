import { Component, HostListener, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { FATchecklist } from '@webproject/data';
import { FATProjectService } from '../fat-project.service';
import { ChecklistConflict, checkSnapshot, mergeChecklist } from '../fat-checklist-merge';
import { HasUnsavedChanges } from '../unsaved-changes.guard';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';

// A heading row and the checks under it (the first group has no heading when a list starts with checks).
export interface ChecklistSection {
  heading: FATchecklist | null;
  rows: FATchecklist[];
}

@Component({
  selector: 'webproject-fat-unit-checklist',
  templateUrl: './fat-unit-checklist.component.html'
})
export class FATUnitChecklistComponent implements OnInit, HasUnsavedChanges {

  // The three answers for a check. Each has an icon as well as text, so the state never depends on colour alone.
  readonly statusOptions = [
    { value: 'Complete', label: 'Complete', icon: 'check', css: 'complete' },
    { value: 'Incomplete', label: 'Incomplete', icon: 'times', css: 'incomplete' },
    { value: 'N/A', label: 'N/A', icon: null, css: 'na' },
  ];

  // Where the save is: '' (nothing happening), 'saving', 'saved' or 'failed'.
  saveState: '' | 'saving' | 'saved' | 'failed' = '';
  private savedTimer: any;

  // Rows the server refused because their serial number is already used, with what to tell the user.
  serialErrors = new Map<FATchecklist, string>();

  // What each row looked like when it was loaded (by position), to tell which rows the user has changed.
  private baselineSource: any = null;
  private baseline: string[] = [];

  // When someone else saved this checklist first: a note saying what happened, and the rows that both of you
  // changed, which the user settles one by one before saving.
  mergeNotice = '';
  conflicts: ChecklistConflict[] = [];
  private resolved = new Set<ChecklistConflict>();

  constructor(
    public FATProjectService: FATProjectService,
    private dialog: MatDialog,
    ) {
      FATProjectService.showError = false;
      FATProjectService.isLoaded = false;
      FATProjectService.notCompany = false;
  }

  ngOnInit() {
    const project = this.getProject();
    const phase = this.getPhase();
    const unit = this.getUnit();
    this.FATProjectService.getCategoryChecklists(this.getCategory(), project, phase, unit);
    this.FATProjectService.getPhaseName(project, phase);
  }

  private isCheck(row: FATchecklist): boolean {
    return row.reference !== 'Heading';
  }

  // Rows the user has edited since the list was loaded or last saved.
  get changedRows(): FATchecklist[] {
    const source = this.FATProjectService.checklistsource;
    if (source !== this.baselineSource) {
      // A fresh list arrived (first load, or after a save): what is on screen is now the saved state.
      this.baselineSource = source;
      this.baseline = source.data.map(row => checkSnapshot(row));
    }
    return source.data.filter((row, i) => this.isCheck(row) && this.baseline[i] !== checkSnapshot(row));
  }

  isChanged(row: FATchecklist): boolean {
    return this.changedRows.indexOf(row) > -1;
  }

  // ---------- when someone else saved first ----------

  // The row a conflict is about, if this is one that still needs settling.
  conflictFor(row: FATchecklist): ChecklistConflict | null {
    const conflict = this.conflicts.find(c => c.mine === row);
    return conflict && !this.resolved.has(conflict) ? conflict : null;
  }

  get unresolvedCount(): number {
    return this.conflicts.filter(c => !this.resolved.has(c)).length;
  }

  keepMine(conflict: ChecklistConflict) {
    this.resolved.add(conflict);
  }

  useTheirs(conflict: ChecklistConflict) {
    const row = conflict.mine;
    const theirs = conflict.theirs;
    row.status = theirs.status;
    row.comment = theirs.comment;
    row.second_checker = theirs.second_checker;
    row.checked_by = theirs.checked_by;
    row.date_checked = theirs.date_checked;
    this.resolved.add(conflict);
  }

  dismissNotice() {
    this.mergeNotice = '';
  }

  // Shows the server's rows (with the user's own unsaved changes put back on top) and makes the server's version the
  // one the next save is based on.
  private adopt(theirs: FATchecklist[], version: number, shown: FATchecklist[]) {
    const source = new MatTableDataSource<FATchecklist>(shown);
    this.FATProjectService.checklistsource = source;
    this.FATProjectService.checklistVersion = version;
    this.baselineSource = source;
    this.baseline = theirs.map(row => checkSnapshot(row));
  }

  // The server refused the save because someone else saved this checklist first. Fetch what they saved and merge
  // it with the user's edits; nothing is saved until the user presses Save again.
  private handleConflict() {
    this.saveState = '';
    this.FATProjectService.fetchChecklist(this.getCategory(), this.getProject(), this.getPhase(), this.getUnit()).subscribe(
      ({ rows, version }) => {
        const merged = mergeChecklist(this.baseline, this.FATProjectService.checklistsource.data, rows);
        this.resolved.clear();
        if (!merged) {
          // The checklist itself changed shape, so the edits cannot be lined up with it.
          this.adopt(rows, version, rows);
          this.conflicts = [];
          this.mergeNotice = 'Someone else changed this checklist, and your edits could not be kept. It has been reloaded.';
          return;
        }
        this.adopt(rows, version, merged.rows);
        this.conflicts = merged.conflicts;
        const parts = ['Someone else saved this checklist while you were working.'];
        if (merged.fromOthers) {
          parts.push(merged.fromOthers + (merged.fromOthers === 1 ? ' check now shows their change.' : ' checks now show their changes.'));
        }
        parts.push(merged.yours ? 'Your changes are kept. Review them, then save.' : 'You had nothing else to save.');
        this.mergeNotice = parts.join(' ');
      },
      (error) => {
        this.saveState = 'failed';
        throw error;
      }
    );
  }

  hasUnsavedChanges(): boolean {
    return this.changedRows.length > 0;
  }

  // Closing or reloading the tab with unsaved edits.
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: any) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // A check counts as done when it is Complete or N/A (the same rule the server uses for progress).
  get checkRows(): FATchecklist[] {
    return this.FATProjectService.checklistsource.data.filter(row => this.isCheck(row));
  }

  get doneCount(): number {
    return this.checkRows.filter(row => row.status === 'Complete' || row.status === 'N/A').length;
  }

  get donePercent(): number {
    const total = this.checkRows.length;
    return total ? Math.round((this.doneCount / total) * 100) : 0;
  }

  // The checks grouped under their headings, rebuilt only when a new list arrives (not on every keystroke).
  private sectionSource: any = null;
  private sectionCache: ChecklistSection[] = [];

  get sections(): ChecklistSection[] {
    const source = this.FATProjectService.checklistsource;
    if (source !== this.sectionSource) {
      this.sectionSource = source;
      const sections: ChecklistSection[] = [];
      let current: ChecklistSection | null = null;
      source.data.forEach(row => {
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

  trackRow(index: number, row: FATchecklist) {
    return row;
  }

  // Serial numbers and unit names need a value typed in per row, so "mark all complete" would be wrong there.
  get bulkAllowed(): boolean {
    const category = this.getCategory();
    return category !== 'Unit Name' && category !== 'Serial Numbers';
  }

  // What the free-text box beside a check is for.
  get notesLabel(): string {
    const category = this.getCategory();
    return category === 'Unit Name' ? 'Unit name' : category === 'Serial Numbers' ? 'Serial number' : 'Notes';
  }

  // Checks nobody has answered yet; an explicit Incomplete or N/A is never overwritten by a bulk action.
  unchecked(rows: FATchecklist[]): FATchecklist[] {
    return rows.filter(row => !row.status);
  }

  get allUnchecked(): FATchecklist[] {
    return this.unchecked(this.checkRows);
  }

  setStatus(row: FATchecklist, value: string) {
    row.status = value;
  }

  // Clicking an answer selects it; clicking the answer that is already selected takes it back (the check becomes
  // unanswered again). A radio button does not do this itself, as clicking a chosen one changes nothing.
  chooseStatus(row: FATchecklist, value: string, event?: Event) {
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
  markComplete(rows: FATchecklist[], where: string) {
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

  // Save needs something to save, nothing already being saved, and any clash with someone else's changes settled.
  get canSave(): boolean {
    return this.saveState !== 'saving' && this.changedRows.length > 0 && this.unresolvedCount === 0;
  }

  saveChanges() {
    if (!this.canSave) {
      return;
    }
    clearTimeout(this.savedTimer);
    this.saveState = 'saving';
    this.serialErrors.clear();
    const category = this.getCategory();
    const project = this.getProject();
    const phase = this.getPhase();
    const unit = this.getUnit();

    this.FATProjectService.updateChecklist(project, phase, unit, category).subscribe(
      () => {
        // Reload from the server so what is shown is what was saved; the fresh list becomes the new baseline.
        this.FATProjectService.getCategoryChecklists(category, project, phase, unit);
        this.saveState = 'saved';
        this.mergeNotice = '';
        this.conflicts = [];
        this.savedTimer = setTimeout(() => this.saveState = '', 4000);
      },
      (error) => {
        if (error && error.status === 409) {
          // Someone else saved this checklist first: show what they saved, with the user's edits kept on top.
          this.handleConflict();
          return;
        }
        if (error && error.status === 400 && error.error && Array.isArray(error.error.duplicates)) {
          // Serial numbers or a unit name the server refused: nothing was saved, so flag those rows and keep what was typed.
          this.showDuplicates(error.error.duplicates);
          return;
        }
        // Keep the user's edits on screen so they can try again.
        this.saveState = 'failed';
        throw error;
      }
    );
  }

  // ---------- serial numbers and unit names the server refused ----------

  private showDuplicates(duplicates: Array<{ index: number, serial: string, reason: string }>) {
    this.saveState = '';
    const rows = this.FATProjectService.checklistsource.data;
    const messages = {
      form: (serial: string) => `${serial} is entered more than once on this checklist.`,
      existing: (serial: string) => `${serial} is already used on another unit.`,
      blank: () => 'Enter the unit name before marking this check Complete.',
    };
    duplicates.forEach(d => {
      if (rows[d.index] && messages[d.reason]) {
        this.serialErrors.set(rows[d.index], messages[d.reason](d.serial));
      }
    });
  }

  serialError(row: FATchecklist): string | null {
    return this.serialErrors.get(row) || null;
  }

  // The message goes as soon as the user starts correcting the value.
  clearSerialError(row: FATchecklist) {
    this.serialErrors.delete(row);
  }

  getProject() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    return routePaths[2].replace(/\%20/g, " ");
  }

  getPhase() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    let phase = routePaths[3];
    return phase.replace(/\%20/g, " ");
  }

  getUnit() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    return routePaths[4].replace(/\%20/g, " ");
  }

  getCategory() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 6);
    return routePaths[5].replace(/\%20/g, " ");
  }

}
