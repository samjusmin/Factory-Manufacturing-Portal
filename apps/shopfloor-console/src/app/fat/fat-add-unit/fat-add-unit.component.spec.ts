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

import { FATAddUnitComponent } from './fat-add-unit.component';
import { FATProjectService } from '../fat-project.service';

describe('FATAddUnitComponent', () => {
  let http: HttpTestingController;
  let component: FATAddUnitComponent;
  let fixture: ComponentFixture<FATAddUnitComponent>;
  let back: jest.SpyInstance;
  let snackOpen: jest.SpyInstance;

  const fillValid = () => component.entryList.at(0).patchValue({
    FATlocation: 'Meridian HQ', FATchecker: 'tenant-a', FATprefix: 'UZ', FATstart: 5001, FATamount: 2, UnitType: 'unit-z',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATAddUnitComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, ReactiveFormsModule, MatDialogModule, MatSnackBarModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-add-unit/PRJ-A/ph1');
    back = jest.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    snackOpen = jest.spyOn(TestBed.inject(MatSnackBar), 'open');
    fixture = TestBed.createComponent(FATAddUnitComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.match(() => true).forEach(req => req.flush(req.request.url.indexOf('/ph1') > -1 ? [{ name: 'Phase 1' }] : true));
    TestBed.inject(FATProjectService).phaseName = 'Phase 1';
  });

  afterEach(() => http.verify());

  it('reads the project and phase from the address', () => {
    expect(component.getProject()).toBe('PRJ-A');
    expect(component.getPhase()).toBe('ph1');
  });

  it('does not send anything while the form is incomplete', () => {
    component.submit();
    http.expectNone('/api/fat-project/PRJ-A');
    expect(component.saveError).toContain('need attention');
  });

  it('lets the checkers see the phase first, and only then creates the units', () => {
    fillValid();
    component.submit();

    const first = http.expectOne('/api/fat-project/PRJ-A');
    expect(first.request.body[3]).toBe('updateCheckers');
    // The second request has not been sent: it waits for the first.
    http.expectNone('/api/factory-acceptance-test/');
    expect(snackOpen).not.toHaveBeenCalled();
    first.flush({});

    const second = http.expectOne('/api/factory-acceptance-test/');
    expect(second.request.body.type).toBe('create');
    expect(second.request.body.data[0].entries[0]).toEqual(
      expect.objectContaining({ prefix: 'UZ', start: 5001, number: 2, unit_type: 'unit-z', checker: 'tenant-a' }));
    expect(snackOpen).not.toHaveBeenCalled();
    second.flush({});

    expect(snackOpen).toHaveBeenCalledWith('2 units added to Phase 1.', 'OK', expect.anything());
    expect(back).toHaveBeenCalled();
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('creates no units when the first step fails, and keeps the entries', () => {
    fillValid();
    component.submit();
    http.expectOne('/api/fat-project/PRJ-A').flush('no', { status: 500, statusText: 'Server Error' });
    http.expectNone('/api/factory-acceptance-test/');
    expect(component.saving).toBe(false);
    expect(component.saveError).toContain('not added');
    expect(back).not.toHaveBeenCalled();
    expect(component.unitCount).toBe(2);
  });

  it('says so when the units could not be created', () => {
    fillValid();
    component.submit();
    http.expectOne('/api/fat-project/PRJ-A').flush({});
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.saving).toBe(false);
    expect(component.saveError).toContain('not added');
    expect(snackOpen).not.toHaveBeenCalled();
  });
});
