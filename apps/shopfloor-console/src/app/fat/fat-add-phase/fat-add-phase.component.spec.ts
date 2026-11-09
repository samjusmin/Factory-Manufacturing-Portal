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

import { FATAddPhaseComponent } from './fat-add-phase.component';

describe('FATAddPhaseComponent', () => {
  let http: HttpTestingController;
  let component: FATAddPhaseComponent;
  let fixture: ComponentFixture<FATAddPhaseComponent>;
  let back: jest.SpyInstance;
  let snackOpen: jest.SpyInstance;

  const fillValid = () => {
    component.form.patchValue({ FATphase: ' Phase 4 ' });
    component.entryList.at(0).patchValue({
      FATlocation: 'Meridian HQ', FATchecker: 'tenant-a', FATprefix: 'UZ', FATstart: 12, FATamount: 3, UnitType: 'unit-z',
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATAddPhaseComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, ReactiveFormsModule, MatDialogModule, MatSnackBarModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-add-phase/PRJ-A');
    back = jest.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    snackOpen = jest.spyOn(TestBed.inject(MatSnackBar), 'open');
    fixture = TestBed.createComponent(FATAddPhaseComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.match(() => true).forEach(req => req.flush(true));
  });

  afterEach(() => http.verify());

  it('reads the project from the address and starts with one empty entry', () => {
    expect(component.getProject()).toBe('PRJ-A');
    expect(component.entryList.length).toBe(1);
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('does not send anything while the form is incomplete', () => {
    component.submit();
    http.expectNone('/api/factory-acceptance-test/');
    expect(component.saveError).toContain('need attention');
    expect(component.form.touched).toBe(true);
  });

  it('adds and removes entries and counts the units', () => {
    fillValid();
    component.addEntry();
    component.entryList.at(1).patchValue({
      FATlocation: 'Dock', FATchecker: 'partner-a', FATprefix: 'UX', FATstart: 1, FATamount: 2, UnitType: 'unit-x1',
    });
    expect(component.unitCount).toBe(5);
    expect(component.hasUnsavedChanges()).toBe(true);
    component.removeEntry(1);
    expect(component.unitCount).toBe(3);
  });

  it('only says the phase was created once the server has answered', () => {
    fillValid();
    component.submit();
    expect(component.saving).toBe(true);
    expect(snackOpen).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    const req = http.expectOne('/api/factory-acceptance-test/');
    expect(req.request.body.type).toBe('createnew');
    expect(req.request.body.data[0]).toEqual({
      project: 'PRJ-A', phase: 'Phase 4',
      entries: [{ location: 'Meridian HQ', prefix: 'UZ', start: 12, number: 3, checker: 'tenant-a', unit_type: 'unit-z', printers: 0, honeywell: 0, options: [] }],
    });
    req.flush({});

    expect(snackOpen).toHaveBeenCalledWith('Phase "Phase 4" created with 3 units.', 'OK', expect.anything());
    expect(back).toHaveBeenCalled();
    expect(component.saving).toBe(false);
    // The phase now exists, so leaving does not ask about unsaved changes.
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('keeps the entries and says so when the phase could not be created', () => {
    fillValid();
    component.submit();
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    // The error is also re-thrown for the app-wide handler (asynchronously), so only the page state is checked here.
    expect(component.saving).toBe(false);
    expect(component.saveError).toContain('not created');
    expect(back).not.toHaveBeenCalled();
    expect(component.form.value.FATphase).toBe(' Phase 4 ');
  });

  it('does not send a second request while one is running', () => {
    fillValid();
    component.submit();
    component.submit();
    http.expectOne('/api/factory-acceptance-test/');
  });
});
