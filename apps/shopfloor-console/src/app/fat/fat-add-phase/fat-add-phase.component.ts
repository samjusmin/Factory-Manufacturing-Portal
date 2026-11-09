import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FATEntry } from '@webproject/data';
import { FATProjectService } from '../fat-project.service';
import { HasUnsavedChanges } from '../unsaved-changes.guard';
import { createUnitEntry, focusFirstInvalid, toFatEntries, totalUnits } from '../fat-unit-entry/fat-unit-entry.component';

@Component({
  selector: 'webproject-fat-add-phase',
  templateUrl: './fat-add-phase.component.html',
  styleUrls: ['./fat-add-phase.component.css']
})

export class FATAddPhaseComponent implements OnInit, HasUnsavedChanges {

  form: FormGroup;
  saving = false;
  // Shown above the buttons when the phase could not be created, so the user's entries stay on screen to retry.
  saveError = '';
  // Set once the phase exists, so leaving the page afterwards does not ask about unsaved changes.
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
      FATphase: ['', [Validators.required, Validators.pattern(/\S/)]],
      FATentries: this.formBuilder.array([ createUnitEntry(this.formBuilder) ])
    });
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
    const routePaths = this.FATProjectService.router.url.split("/", 3);
    return decodeURIComponent(routePaths[2]);
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
      this.saveError = 'Some fields need attention before the phase can be created.';
      focusFirstInvalid();
      return;
    }
    const phase = this.form.value.FATphase.trim();
    const units = this.unitCount;
    this.saving = true;
    this.saveError = '';

    this.FATProjectService.createPhase(this.getProject(), phase, this.entries).subscribe(
      () => {
        this.saving = false;
        this.created = true;
        this.snackBar.open('Phase "' + phase + '" created with ' + units + (units === 1 ? ' unit' : ' units') + '.', 'OK', { duration: 5000 });
        this._location.back();
      },
      (error) => {
        this.saving = false;
        if (error && error.status === 409 && error.error && error.error.message) {
          // Unit numbers that already exist: the user can fix this here, so it is not an error to report.
          this.saveError = error.error.message;
          return;
        }
        this.saveError = 'The phase was not created. Your entries are still here, so you can try again.';
        throw error;
      }
    );
  }

  cancel() {
    this._location.back();
  }
}
