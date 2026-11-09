import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FATProjectService } from '../fat-project.service';

@Component({
  selector: 'webproject-fat-move-units',
  templateUrl: './fat-move-units.component.html',
  styleUrls: ['./fat-move-units.component.css']
})

export class FATMoveUnitsComponent implements OnInit {

  form: FormGroup;
  // The unit numbers ticked for moving (only ever units of the "from" phase).
  selected = new Set<string>();
  saving = false;
  saveError = '';

  constructor(
    private _location: Location,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    public FATProjectService: FATProjectService,
  ) {
    FATProjectService.showError = false;
  }

  ngOnInit() {
    this.FATProjectService.checkIfAdmin();
    this.form = this.formBuilder.group({
      FromFATphase: ['', Validators.required],
      ToFATphase: ['', Validators.required],
    });
    this.FATProjectService.getProjectPhases(this.getProject());
  }

  getProject(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 3)[2]);
  }

  get units() {
    return this.FATProjectService.unitsource.data;
  }

  get fromSelected(): boolean {
    return !!this.form.value.FromFATphase;
  }

  get allSelected(): boolean {
    return this.units.length > 0 && this.selected.size === this.units.length;
  }

  get someSelected(): boolean {
    return this.selected.size > 0 && !this.allSelected;
  }

  // Name of the phase with its unit count, so the choice shows what is in it.
  phaseLabel(phase: { name: string, numOfUnits?: number }): string {
    const n = phase.numOfUnits;
    return n === undefined ? phase.name : phase.name + ' (' + n + (n === 1 ? ' unit' : ' units') + ')';
  }

  phaseName(id: string): string {
    const phase = this.FATProjectService.phasesource.data.find(p => p.id === id);
    return phase ? phase.name : '';
  }

  get canMove(): boolean {
    return this.form.valid && this.selected.size > 0 && !this.saving;
  }

  onFromPhaseChange() {
    // Units are stored against the phase id; clear any selection made for the previous phase.
    this.selected.clear();
    this.saveError = '';
    if (this.form.value.ToFATphase === this.form.value.FromFATphase) {
      this.form.patchValue({ ToFATphase: '' });
    }
    this.FATProjectService.getAllProjectPhaseUnits(this.getProject(), this.form.value.FromFATphase);
  }

  isSelected(docNo: string): boolean {
    return this.selected.has(docNo);
  }

  toggle(docNo: string, checked: boolean) {
    if (checked) {
      this.selected.add(docNo);
    } else {
      this.selected.delete(docNo);
    }
  }

  toggleAll(checked: boolean) {
    this.selected.clear();
    if (checked) {
      this.units.forEach(u => this.selected.add(u.doc_no));
    }
  }

  onSubmit() {
    if (!this.canMove) {
      return;
    }
    const count = this.selected.size;
    const to = this.phaseName(this.form.value.ToFATphase);
    this.saving = true;
    this.saveError = '';

    this.FATProjectService.moveUnits(this.getProject(), this.form.value.FromFATphase, this.form.value.ToFATphase, Array.from(this.selected)).subscribe(
      () => {
        this.saving = false;
        this.snackBar.open('Moved ' + count + (count === 1 ? ' unit' : ' units') + ' to ' + to + '.', 'OK', { duration: 5000 });
        this._location.back();
      },
      (error) => {
        this.saving = false;
        this.saveError = 'The units were not moved. Your selection is still here, so you can try again.';
        throw error;
      }
    );
  }

  cancel() {
    this._location.back();
  }
}
