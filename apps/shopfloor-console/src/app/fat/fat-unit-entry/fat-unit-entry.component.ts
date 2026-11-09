import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FATEntry } from '@webproject/data';
import { FAT_CHECKERS, FAT_UNIT_OPTIONS, FAT_UNIT_TYPES } from '../fat-options';

// The most units one entry may create; a guard against a typo such as 2000 instead of 20.
export const MAX_UNITS_PER_ENTRY = 200;

// One row of the Add Phase / Add Unit forms: a run of identical units.
export function createUnitEntry(fb: FormBuilder): FormGroup {
  return fb.group({
    FATlocation: ['', [Validators.required, Validators.pattern(/\S/)]],
    FATchecker: ['', Validators.required],
    FATprefix: ['', [Validators.required, Validators.pattern(/\S/)]],
    FATstart: [null, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    FATamount: [null, [Validators.required, Validators.min(1), Validators.max(MAX_UNITS_PER_ENTRY), Validators.pattern(/^\d+$/)]],
    UnitType: ['', Validators.required],
    FATprinters: [null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
    FAThoneywell: [null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
    FAToptions: [[]],
  });
}

// Turns the form values into what the API expects (numbers as numbers, empty boxes as zero or no options).
export function toFatEntries(values: any[]): FATEntry[] {
  return values.map(v => ({
    location: (v.FATlocation || '').trim(),
    prefix: (v.FATprefix || '').trim(),
    start: Number(v.FATstart),
    number: Number(v.FATamount),
    checker: v.FATchecker,
    unit_type: v.UnitType,
    printers: Number(v.FATprinters) || 0,
    honeywell: Number(v.FAThoneywell) || 0,
    options: Array.isArray(v.FAToptions) ? v.FAToptions : [],
  }));
}

// "Will create 9 units: UZ12 to UZ20", or nothing until enough has been typed to say.
export function entryPreview(v: any): string {
  const prefix = (v.FATprefix || '').trim();
  const start = Number(v.FATstart);
  const amount = Number(v.FATamount);
  if (!prefix || v.FATstart === null || v.FATstart === '' || isNaN(start) || !(amount >= 1)) {
    return '';
  }
  const first = prefix + start;
  return amount === 1 ? 'Will create 1 unit: ' + first : 'Will create ' + amount + ' units: ' + first + ' to ' + prefix + (start + amount - 1);
}

// How many units a set of entries would create.
export function totalUnits(entries: FATEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.number > 0 ? e.number : 0), 0);
}

@Component({
  selector: 'webproject-fat-unit-entry',
  templateUrl: './fat-unit-entry.component.html',
  styleUrls: ['./fat-unit-entry.component.css']
})
export class FATUnitEntryComponent {
  @Input() group: FormGroup;
  @Input() index = 0;
  @Input() removable = false;
  @Output() remove = new EventEmitter<void>();

  readonly checkers = FAT_CHECKERS;
  readonly unitTypes = FAT_UNIT_TYPES;
  readonly unitOptions = FAT_UNIT_OPTIONS;
  readonly maxUnits = MAX_UNITS_PER_ENTRY;

  get preview(): string {
    return entryPreview(this.group.value);
  }
}

// After a failed submit, moves the keyboard to the first field that needs attention.
export function focusFirstInvalid() {
  setTimeout(() => {
    const field = document.querySelector('.mat-form-field-invalid input, .mat-form-field-invalid .mat-select') as HTMLElement | null;
    if (field) {
      field.focus();
    }
  });
}
