import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FATProjectService } from '../fat-project.service';
import { HasUnsavedChanges } from '../unsaved-changes.guard';
import { unitTypeName } from '../fat-options';

@Component({
  selector: 'webproject-fat-add-checklist',
  templateUrl: './fat-add-checklist.component.html',
  styleUrls: ['./fat-add-checklist.component.css']
})

export class FATAddChecklistComponent implements OnInit, HasUnsavedChanges {
  baseform: FormGroup;
  addform: FormGroup;
  saving = false;
  // Shown above the buttons when the checklists could not be added, so the choices stay on screen to retry.
  saveError = '';
  private added = false;
  generalList = ["Unit Name", "Kiosk Common", "Unit X1 Common", "KioskA Common","Bios", "Serial Numbers"];
  hardwareList = ["Unit Z Hardware", "Unit Z Plus Hardware", "Unit Z Compact Hardware", "Unit W2 Hardware"];

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
    const project = this.getProject();
    const phase = this.getPhase();

    // Start from nothing: the lists belong to the unit type chosen below, not to the last one looked at.
    this.FATProjectService.typeunitsource = [];
    this.FATProjectService.categorysource = [];
    this.FATProjectService.getTypesinPhase(project, phase);

    this.baseform = this.formBuilder.group({
      type: ['', Validators.required]
    });
    this.addform = this.formBuilder.group({
      FATprinters: [null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
      FAThoneywell: [null, [Validators.min(0), Validators.pattern(/^\d+$/)]],
      FAToptions: [[]]
    });

    this.FATProjectService.getPhaseName(project, phase);
  }

  getProject(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 4)[2]);
  }

  getPhase(): string {
    return decodeURIComponent(this.FATProjectService.router.url.split("/", 4)[3]);
  }

  get selectedType(): string {
    return this.baseform.value.type;
  }

  typeLabel(type: string): string {
    return unitTypeName(type);
  }

  get unitCount(): number {
    return this.FATProjectService.typeunitsource.length;
  }

  typeSelected(): boolean {
    return !!this.selectedType;
  }

  onTypeChange() {
    this.addform.reset({ FATprinters: null, FAThoneywell: null, FAToptions: [] });
    this.saveError = '';
    // Clear the previous type's lists so they do not show against the new type while it loads.
    this.FATProjectService.typeunitsource = [];
    this.FATProjectService.categorysource = [];
    this.FATProjectService.getAllUnitType(this.getProject(), this.getPhase(), this.selectedType);
  }

  isThisIn(category: string, list: Array<string>) {
    return list.includes(category);
  }

  isPrinter(checkThis: string) {
    return checkThis.includes("Printer") && !checkThis.includes("Honeywell");
  }

  isHoneywell(checkThis: string) {
    return checkThis.includes("Honeywell Scanner");
  }

  // Nothing to add yet: no printers, no scanners and no options.
  isFormEmpty(): boolean {
    const v = this.addform.value;
    return !Number(v.FATprinters) && !Number(v.FAThoneywell) && !(v.FAToptions && v.FAToptions.length);
  }

  get canAdd(): boolean {
    return this.typeSelected() && this.addform.valid && !this.isFormEmpty() && !this.saving;
  }

  hasUnsavedChanges(): boolean {
    return !this.added && this.typeSelected() && !this.isFormEmpty();
  }

  onSubmit() {
    if (!this.canAdd) {
      return;
    }
    const units = this.unitCount;
    const type = this.typeLabel(this.selectedType);
    const v = this.addform.value;
    this.saving = true;
    this.saveError = '';

    this.FATProjectService.addChecklists(this.getProject(), this.getPhase(), this.selectedType, Number(v.FATprinters), Number(v.FAThoneywell), v.FAToptions).subscribe(
      () => {
        this.saving = false;
        this.added = true;
        this.snackBar.open('Checklists added to ' + units + ' ' + type + (units === 1 ? ' unit.' : ' units.'), 'OK', { duration: 5000 });
        this._location.back();
      },
      (error) => {
        this.saving = false;
        this.saveError = 'The checklists were not added. Your choices are still here, so you can try again.';
        throw error;
      }
    );
  }

  goBack() {
    this._location.back();
  }
}
