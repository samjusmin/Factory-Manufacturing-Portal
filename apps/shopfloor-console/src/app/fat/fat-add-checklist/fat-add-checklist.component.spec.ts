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

import { FATAddChecklistComponent } from './fat-add-checklist.component';
import { FATProjectService } from '../fat-project.service';

describe('FATAddChecklistComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATAddChecklistComponent;
  let fixture: ComponentFixture<FATAddChecklistComponent>;
  let back: jest.SpyInstance;
  let snackOpen: jest.SpyInstance;

  // Chooses a unit type and loads the units and categories of that type.
  const chooseType = () => {
    component.baseform.patchValue({ type: 'unit-z' });
    component.onTypeChange();
    http.expectOne('/api/factory-acceptance-test/PRJ-A/ph1/unit-z/getTypeUnits').flush({
      units: [{ doc_no: 'UZ1' }, { doc_no: 'UZ2' }],
      categories: [{ name: 'Kiosk Common' }, { name: 'NFC' }],
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATAddChecklistComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, ReactiveFormsModule, MatDialogModule, MatSnackBarModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-add-checklist/PRJ-A/ph1');
    back = jest.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    snackOpen = jest.spyOn(TestBed.inject(MatSnackBar), 'open');
    fixture = TestBed.createComponent(FATAddChecklistComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/PRJ-A/ph1/getTypes').flush([{ _id: 'unit-z' }]);
    http.expectOne('/api/fat-project/PRJ-A/ph1').flush([{ name: 'Phase 1' }]);
  });

  afterEach(() => http.verify());

  it('offers the unit types that are in the phase', () => {
    expect(service.typesource).toEqual(['unit-z']);
    expect(component.typeLabel('unit-z')).toBe('Unit Z');
    expect(component.typeSelected()).toBe(false);
  });

  it('shows the units and categories of the chosen type', () => {
    chooseType();
    expect(component.unitCount).toBe(2);
    expect(service.categorysource.map(c => c.name)).toEqual(['Kiosk Common', 'NFC']);
    // The option that is already on the units is not offered again.
    expect(service.excludedOptions.some(o => o.name === 'NFC')).toBe(false);
    expect(service.excludedOptions.some(o => o.name === 'Magnetic Card')).toBe(true);
  });

  it('cannot add until a type is chosen and something is asked for', () => {
    expect(component.canAdd).toBe(false);
    chooseType();
    expect(component.isFormEmpty()).toBe(true);
    expect(component.canAdd).toBe(false);
    component.addform.patchValue({ FATprinters: 1 });
    expect(component.canAdd).toBe(true);
    component.addform.patchValue({ FATprinters: -1 });
    expect(component.canAdd).toBe(false);
    component.addform.patchValue({ FATprinters: null, FAToptions: ['FATmagnetic'] });
    expect(component.canAdd).toBe(true);
  });

  it('forgets the previous type\'s choices when the type changes', () => {
    chooseType();
    component.addform.patchValue({ FATprinters: 2 });
    component.onTypeChange();
    http.expectOne('/api/factory-acceptance-test/PRJ-A/ph1/unit-z/getTypeUnits').flush({ units: [], categories: [] });
    expect(component.isFormEmpty()).toBe(true);
  });

  it('only says the checklists were added once the server has answered', () => {
    chooseType();
    component.addform.patchValue({ FATprinters: 1, FAToptions: ['FATmagnetic'] });
    expect(component.hasUnsavedChanges()).toBe(true);
    component.onSubmit();
    expect(component.saving).toBe(true);
    expect(snackOpen).not.toHaveBeenCalled();

    const req = http.expectOne('/api/factory-acceptance-test/');
    expect(req.request.body).toEqual({
      type: 'addChecklists',
      data: [{ project: 'PRJ-A', phase: 'ph1', type: 'unit-z', printers: 1, honeywell: 0, options: ['FATmagnetic'] }],
    });
    req.flush({});

    expect(snackOpen).toHaveBeenCalledWith('Checklists added to 2 Unit Z units.', 'OK', expect.anything());
    expect(back).toHaveBeenCalled();
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('keeps the choices and says so when adding fails', () => {
    chooseType();
    component.addform.patchValue({ FAThoneywell: 2 });
    component.onSubmit();
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.saving).toBe(false);
    expect(component.saveError).toContain('not added');
    expect(component.addform.value.FAThoneywell).toBe(2);
    expect(snackOpen).not.toHaveBeenCalled();
  });
});
