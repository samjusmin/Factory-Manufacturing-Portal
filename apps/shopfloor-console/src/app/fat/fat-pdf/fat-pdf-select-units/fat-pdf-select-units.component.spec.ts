import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FatPdfSelectUnitsComponent } from './fat-pdf-select-units.component';
import { FATProjectService } from '../../fat-project.service';
import * as exporter from '../../fat-report/fat-report-export';

const units = [
  { doc_no: 'UZ1', unit_no: 'SN1', location: 'HQ', unit_type: 'unit-z', progress: 50 },
  { doc_no: 'UZ2', unit_no: '', location: 'HQ', unit_type: 'unit-z', progress: 100 },
];
const docs = [
  { doc_no: 'UZ1', unit_no: 'SN1', project: 'P1', phase: 'ph1', unit_type: 'unit-z', location: 'HQ', progress: 50, category: [] },
];

describe('FatPdfSelectUnitsComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FatPdfSelectUnitsComponent;
  let fixture: ComponentFixture<FatPdfSelectUnitsComponent>;
  let csv: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FatPdfSelectUnitsComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, ReactiveFormsModule, MatDialogModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-pdf-select/P1/ph1');
    csv = jest.spyOn(exporter, 'exportReportCsv').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(FatPdfSelectUnitsComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush(units);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);
  });

  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  it('selects and clears every unit at once', () => {
    component.toggleAll(true);
    expect(component.emailFormArray).toEqual(['UZ1', 'UZ2']);
    expect(component.allSelected).toBe(true);
    component.onChange('UZ1', false);
    expect(component.someSelected).toBe(true);
    component.toggleAll(false);
    expect(component.emailFormArray).toEqual([]);
  });

  it('does nothing until a unit is selected', () => {
    component.onSubmit();
    component.exportCsv();
    http.expectNone('/api/factory-acceptance-test/P1/ph1');
  });

  it('opens the preview with the chosen units', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component.onChange('UZ1', true);
    component.onSubmit();
    expect(component.working).toBe('preview');
    const req = http.expectOne('/api/factory-acceptance-test/P1/ph1');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ data: ['UZ1'] });
    req.flush(docs);
    expect(navigate).toHaveBeenCalledWith('/FAT-pdf');
  });

  it('keeps the selection and says so when the preview cannot be prepared', () => {
    component.onChange('UZ1', true);
    component.onSubmit();
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.emailFormArray).toEqual(['UZ1']);
    expect(component.exporting).toBe(false);
    expect(component.error).toContain('still here');
  });

  it('downloads a CSV of the chosen units without the preview', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component.onChange('UZ1', true);
    component.exportCsv();
    expect(component.working).toBe('csv');
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush(docs);
    expect(csv).toHaveBeenCalledTimes(1);
    expect(csv.mock.calls[0][0].units.map(u => u.doc_no)).toEqual(['UZ1']);
    expect(navigate).not.toHaveBeenCalled();
    expect(component.exporting).toBe(false);
    // The selection stays, so another export can follow.
    expect(component.emailFormArray).toEqual(['UZ1']);
  });

  it('keeps the selection and says so when the CSV cannot be prepared', () => {
    component.onChange('UZ1', true);
    component.exportCsv();
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush('no', { status: 500, statusText: 'Server Error' });
    expect(csv).not.toHaveBeenCalled();
    expect(component.emailFormArray).toEqual(['UZ1']);
    expect(component.error).toContain('CSV');
    expect(service.unitsource.data.length).toBe(2);
  });
});
