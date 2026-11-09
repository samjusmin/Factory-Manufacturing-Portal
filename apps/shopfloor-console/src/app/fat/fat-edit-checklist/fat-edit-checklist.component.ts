import { Component, HostListener, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FATProjectService } from '../fat-project.service';
import { HasUnsavedChanges } from '../unsaved-changes.guard';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';

// A row of the checklist template while it is being edited.
export interface TemplateRow {
  description: string;
  reference: string;
}

@Component({
  selector: 'webproject-fat-edit-checklist',
  templateUrl: './fat-edit-checklist.component.html',
  styleUrls: ['./fat-edit-checklist.component.css']
})
export class FATEditChecklistComponent implements OnInit, HasUnsavedChanges {

  rows: TemplateRow[] = [];
  loaded = false;
  loadError = false;
  // Where the save is: '' (nothing happening), 'saving', 'saved' or 'failed'.
  saveState: '' | 'saving' | 'saved' | 'failed' = '';
  private savedTimer: any;

  // What each row looked like when it was loaded or last saved, to show which rows have been edited.
  private baselineRows = new Map<TemplateRow, string>();
  private baseline = '';

  constructor(
    public FATProjectService: FATProjectService,
    private dialog: MatDialog,
  ) {
    FATProjectService.isLoaded = false;
    FATProjectService.showError = false;
  }

  ngOnInit() {
    this.FATProjectService.checkIfAdmin();
    this.load();
  }

  getCategory(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 3)[2]);
  }

  load() {
    this.loaded = false;
    this.loadError = false;
    this.FATProjectService.getChecklistTemplate(this.getCategory()).subscribe(
      (res) => {
        this.rows = (res || []).map(r => ({ description: r.description || '', reference: r.reference || '' }));
        this.markSaved();
        this.loaded = true;
        this.FATProjectService.isLoaded = true;
      },
      (error) => {
        this.loadError = true;
        this.FATProjectService.isLoaded = true;
        throw error;
      }
    );
  }

  private rowSnapshot(row: TemplateRow): string {
    return JSON.stringify([row.description, row.reference]);
  }

  // The rows as they are now are the saved state.
  private markSaved() {
    this.baselineRows = new Map(this.rows.map(r => [r, this.rowSnapshot(r)] as [TemplateRow, string]));
    this.baseline = JSON.stringify(this.rows.map(r => this.rowSnapshot(r)));
  }

  // True once anything has been edited, added, removed or reordered since the last save.
  hasUnsavedChanges(): boolean {
    return this.loaded && JSON.stringify(this.rows.map(r => this.rowSnapshot(r))) !== this.baseline;
  }

  // A new row, or one whose text has changed.
  isChanged(row: TemplateRow): boolean {
    return this.baselineRows.get(row) !== this.rowSnapshot(row);
  }

  // Rows with no description cannot be saved (a check nobody can read is no use to the operator).
  get blankRows(): number {
    return this.rows.filter(r => !r.description.trim()).length;
  }

  get canSave(): boolean {
    return this.saveState !== 'saving' && this.hasUnsavedChanges() && this.blankRows === 0;
  }

  // Closing or reloading the tab with unsaved edits.
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: any) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  trackRow(index: number, row: TemplateRow) {
    return row;
  }

  addRow() {
    this.rows.push({ description: '', reference: '' });
    // Put the cursor in the new row so the user can start typing.
    setTimeout(() => {
      const inputs = document.querySelectorAll('.edit-row:last-child input');
      if (inputs.length) {
        (inputs[0] as HTMLElement).focus();
      }
    });
  }

  removeRow(row: TemplateRow) {
    // A row that is still empty has nothing to lose, so it goes without asking.
    if (!row.description.trim() && !row.reference.trim()) {
      this.rows.splice(this.rows.indexOf(row), 1);
      return;
    }
    this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Remove this row?',
        message: 'Remove "' + (row.description.trim() || row.reference.trim()) + '" from the checklist? It is only removed once you press Save.',
        confirmLabel: 'Remove',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.rows.splice(this.rows.indexOf(row), 1);
      }
    });
  }

  saveChanges() {
    if (!this.canSave) {
      return;
    }
    clearTimeout(this.savedTimer);
    this.saveState = 'saving';
    const saved = this.rows.map(r => ({ description: r.description.trim(), reference: r.reference.trim() }));

    this.FATProjectService.saveChecklistTemplate(this.getCategory(), saved).subscribe(
      () => {
        this.rows.forEach((r, i) => { r.description = saved[i].description; r.reference = saved[i].reference; });
        this.markSaved();
        this.saveState = 'saved';
        this.savedTimer = setTimeout(() => this.saveState = '', 4000);
      },
      (error) => {
        // Keep the edits on screen so they can try again.
        this.saveState = 'failed';
        throw error;
      }
    );
  }
}
