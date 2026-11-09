import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FATEntry } from '@webproject/data';
import { FATProjectService } from '../fat-project.service';
import { HasUnsavedChanges } from '../unsaved-changes.guard';
import { createUnitEntry, focusFirstInvalid, toFatEntries, totalUnits } from '../fat-unit-entry/fat-unit-entry.component';

@Component({
  selector: 'webproject-fat-add-unit',
  templateUrl: './fat-add-unit.component.html',
  styleUrls: ['./fat-add-unit.component.css']
})

export class FATAddUnitComponent implements OnInit, HasUnsavedChanges {

  form: FormGroup;
  saving = false;
  // Shown above the buttons when the units could not be added, so the entries stay on screen to retry.
  saveError = '';
  private created = false;

  constructor(
    private _location: Location,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    public FATProjectService: FATProjectService,
  ) {
  }

  ngOnInit() {
    this.FATProjectService.checkIfAdmin();
    this.form = this.formBuilder.group({
      FATentries: this.formBuilder.array([ createUnitEntry(this.formBuilder) ])
    });
    this.FATProjectService.getPhaseName(this.getProject(), this.getPhase());
  }

  get entryList(): FormArray {
    return this.form.get('FATentries') as FormArray;
  }

  get entries(): FATEntry[] {
    return toFatEntries(this.entryList.value);
  }

  get unitCount(): number {
    return totalUnits(this.entries);
  }

  getProject(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 4)[2]);
  }

  getPhase(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 4)[3]);
  }

  addEntry() {
    this.entryList.push(createUnitEntry(this.formBuilder));
    this.form.markAsDirty();
  }

  removeEntry(i: number) {
    this.entryList.removeAt(i);
    this.form.markAsDirty();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.created;
  }

  submit() {
    if (this.saving) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError = 'Some fields need attention before the units can be added.';
      focusFirstInvalid();
      return;
    }
    const units = this.unitCount;
    this.saving = true;
    this.saveError = '';

    // Two steps on the server (make the phase visible to the checkers, then create the units); the units are only
    // created if the first step worked, and the page only says "added" when both have finished.
    this.FATProjectService.createUnits(this.getProject(), this.getPhase(), this.entries).subscribe(
      () => {
        this.saving = false;
        this.created = true;
        this.snackBar.open(units + (units === 1 ? ' unit' : ' units') + ' added to ' + this.FATProjectService.phaseName + '.', 'OK', { duration: 5000 });
        this._location.back();
      },
      (error) => {
        this.saving = false;
        if (error && error.status === 409 && error.error && error.error.message) {
          // Unit numbers that already exist: the user can fix this here, so it is not an error to report.
          this.saveError = error.error.message;
          return;
        }
        this.saveError = 'The units were not added. Your entries are still here, so you can try again.';
        throw error;
      }
    );
  }

  cancel() {
    this._location.back();
  }
}
