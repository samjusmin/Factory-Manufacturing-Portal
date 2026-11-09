import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FATMoveUnitsComponent } from './fat-move-units.component';
import { FATProjectService } from '../fat-project.service';

const phases = [
  { id: 'p1', name: 'Phase 1', numOfUnits: 3, progress: 50 },
  { id: 'p2', name: 'Phase 2', numOfUnits: 1, progress: 0 },
];
const units = [
  { doc_no: 'UZ1', unit_no: 'SN1', progress: 10 },
  { doc_no: 'UZ2', unit_no: '', progress: 0 },
  { doc_no: 'UZ3', unit_no: '', progress: 100 },
];

describe('FATMoveUnitsComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATMoveUnitsComponent;
  let fixture: ComponentFixture<FATMoveUnitsComponent>;
  let back: jest.SpyInstance;
  let snackOpen: jest.SpyInstance;

  // Chooses the "from" phase and loads its units, the way the page does when the dropdown changes.
  const chooseFrom = () => {
    component.form.patchValue({ FromFATphase: 'p1' });
    component.onFromPhaseChange();
    http.expectOne('/api/factory-acceptance-test/PRJ-A/p1').flush(units);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATMoveUnitsComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, ReactiveFormsModule, MatDialogModule, MatSnackBarModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-move-units/PRJ-A');
    back = jest.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    snackOpen = jest.spyOn(TestBed.inject(MatSnackBar), 'open');
    fixture = TestBed.createComponent(FATMoveUnitsComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/fat-project/PRJ-A').flush(phases);
  });

  afterEach(() => http.verify());

  it('labels each phase with how many units it holds', () => {
    expect(component.phaseLabel(phases[0])).toBe('Phase 1 (3 units)');
    expect(component.phaseLabel(phases[1])).toBe('Phase 2 (1 unit)');
    expect(component.phaseLabel({ name: 'Phase 3' })).toBe('Phase 3');
  });

  it('cannot move anything until phases are chosen and a unit is ticked', () => {
    expect(component.canMove).toBe(false);
    chooseFrom();
    component.form.patchValue({ ToFATphase: 'p2' });
    expect(component.canMove).toBe(false);
    component.toggle('UZ1', true);
    expect(component.canMove).toBe(true);
    component.toggle('UZ1', false);
    expect(component.canMove).toBe(false);
  });

  it('selects and clears every unit at once', () => {
    chooseFrom();
    component.toggleAll(true);
    expect(component.selected.size).toBe(3);
    expect(component.allSelected).toBe(true);
    component.toggle('UZ2', false);
    expect(component.someSelected).toBe(true);
    expect(component.allSelected).toBe(false);
    component.toggleAll(false);
    expect(component.selected.size).toBe(0);
  });

  it('forgets the ticked units, and a matching target, when the from phase changes', () => {
    chooseFrom();
    component.form.patchValue({ ToFATphase: 'p1' });
    component.toggle('UZ1', true);
    component.form.patchValue({ FromFATphase: 'p1' });
    component.onFromPhaseChange();
    http.expectOne('/api/factory-acceptance-test/PRJ-A/p1').flush(units);
    expect(component.selected.size).toBe(0);
    expect(component.form.value.ToFATphase).toBe('');
  });

  it('only says the units were moved once the server has answered', () => {
    chooseFrom();
    component.form.patchValue({ ToFATphase: 'p2' });
    component.toggleAll(true);
    component.onSubmit();
    expect(component.saving).toBe(true);
    expect(snackOpen).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    const req = http.expectOne('/api/factory-acceptance-test/');
    expect(req.request.body).toEqual({
      type: 'move',
      data: [{ project: 'PRJ-A', fromPhase: 'p1', toPhase: 'p2', units: ['UZ1', 'UZ2', 'UZ3'] }],
    });
    req.flush({});

    expect(snackOpen).toHaveBeenCalledWith('Moved 3 units to Phase 2.', 'OK', expect.anything());
    expect(back).toHaveBeenCalled();
  });

  it('keeps the selection and says so when the move fails', () => {
    chooseFrom();
    component.form.patchValue({ ToFATphase: 'p2' });
    component.toggle('UZ1', true);
    component.onSubmit();
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.saving).toBe(false);
    expect(component.saveError).toContain('not moved');
    expect(component.selected.has('UZ1')).toBe(true);
    expect(snackOpen).not.toHaveBeenCalled();
    expect(service.unitsource.data.length).toBe(3);
  });

  it('does not send a move when nothing is ticked', () => {
    chooseFrom();
    component.form.patchValue({ ToFATphase: 'p2' });
    component.onSubmit();
    http.expectNone('/api/factory-acceptance-test/');
  });
});
