import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTable } from '@angular/material/table';
import { IConfigCheck } from '@webproject/data';
import { ConfigService } from '../config.service';
import { errorMessage } from '../config-view';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';
import { HasUnsavedChanges } from '../../fat/unsaved-changes.guard';

// The checklist for one hardware type (administrators): the checks, and section headings that group them. New units of
// the type start from it; units that already exist keep their own copy.
@Component({
  selector: 'webproject-config-edit-checklist',
  templateUrl: './config-edit-checklist.component.html'
})
export class ConfigEditChecklistComponent implements OnInit, HasUnsavedChanges {

  @ViewChild(MatTable) table: MatTable<any>;

  checklistSource: IConfigCheck[] = [];
  category = '';
  loaded = false;
  loadMessage = '';
  saving = false;
  // Set once a row is edited, added or removed, and cleared by a save.
  dirty = false;

  columnNames = [
    { id: 'description', value: 'Description' },
    { id: 'reference', value: 'Reference' },
    { id: 'remove', value: '' }
  ];
  displayedColumns = this.columnNames.map((x) => x.id);

  constructor(
    public ConfigService: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    ConfigService.isAdmin = false;
    ConfigService.showError = false;
  }

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    this.load();
  }

  load(): void {
    this.loadMessage = '';
    this.ConfigService.getCatalogueType(this.getType()).subscribe((type) => {
      this.checklistSource = type.checklist || [];
      this.category = type.category;
      this.loaded = true;
    }, (error) => {
      this.loadMessage = errorMessage(error, 'The checklist could not be loaded.');
      this.loaded = true;
    });
  }

  getType(): string {
    return this.route.snapshot.paramMap.get('type');
  }

  isHeading(row: IConfigCheck): boolean {
    return row.reference === 'Heading';
  }

  addChecklist() {
    this.dirty = true;
    this.checklistSource.push({ description: '', reference: null, status: null, checked_by: null, date_checked: null, comment: null });
    this.table.renderRows();
  }

  // A heading groups the checks under it, like the section headings of a FAT checklist.
  addHeading() {
    this.dirty = true;
    this.checklistSource.push({ description: '', reference: 'Heading', status: null, checked_by: null, date_checked: null, comment: null });
    this.table.renderRows();
  }

  removeChecklist(index: number) {
    this.dirty = true;
    this.checklistSource.splice(index, 1);
    this.table.renderRows();
  }

  markDirty() {
    this.dirty = true;
  }

  saveChanges() {
    if (this.saving) {
      return;
    }
    const rows = this.checklistSource
      .filter((c) => (c.description || '').trim() !== '')
      .map((c) => ({
        description: c.description.trim(),
        reference: this.isHeading(c) ? 'Heading' : (c.reference || null),
        status: null,
        checked_by: null,
        date_checked: null,
        comment: null
      }));

    this.saving = true;
    this.ConfigService.saveChecklist(this.getType(), rows).subscribe(() => {
      this.saving = false;
      this.checklistSource = rows;
      this.table.renderRows();
      this.dirty = false;
      this.snackBar.open('Checklist saved.', 'OK', { duration: 4000 });
    }, (error) => {
      this.saving = false;
      if (error && error.status === 401) {
        throw error;
      }
      this.snackBar.open(errorMessage(error, 'That could not be saved. Please try again.'), 'OK', { duration: 8000 });
    });
  }

  // Deletes the hardware type itself. The server refuses while units, a location or an image still use it.
  deleteType() {
    this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Delete hardware type',
        message: `Delete ${this.getType()} and its checklist? This cannot be undone.`,
        confirmLabel: 'Delete',
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
      this.ConfigService.deleteType(this.getType()).subscribe(() => {
        this.dirty = false;
        this.snackBar.open('Hardware type deleted.', 'OK', { duration: 4000 });
        this.router.navigate(['/config-edit-cat']);
      }, (error) => {
        if (error && error.status === 401) {
          throw error;
        }
        this.snackBar.open(errorMessage(error, 'That could not be deleted.'), 'OK', { duration: 8000 });
      });
    });
  }

  // Leaving with unsaved edits asks first, whichever way the user leaves (see the route's UnsavedChangesGuard).
  goBack() {
    this.ConfigService.goBack();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  // Closing or reloading the tab with unsaved edits.
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: any) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
