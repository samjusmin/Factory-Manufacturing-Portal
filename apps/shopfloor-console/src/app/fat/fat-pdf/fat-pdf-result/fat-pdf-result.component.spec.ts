import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FatPdfResultComponent } from './fat-pdf-result.component';
import { FATProjectService } from '../../fat-project.service';
import * as exporter from '../../fat-report/fat-report-export';

const docs = [
  {
    doc_no: 'UZ1', unit_no: 'SN1', project: 'P1', phase: 'ph1', unit_type: 'unit-z', location: 'HQ', progress: 50,
    category: [{ name: 'Kiosk Common', progress: 50, checklists: [{ description: 'A', status: 'Complete' }, { description: 'B', status: 'Incomplete', comment: 'bad' }] }],
  },
];

describe('FatPdfResultComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FatPdfResultComponent;
  let fixture: ComponentFixture<FatPdfResultComponent>;
  let pdf: jest.SpyInstance;
  let csv: jest.SpyInstance;

  const open = (data: any) => {
    service.setPdfData(data);
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FatPdfResultComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    pdf = jest.spyOn(exporter, 'exportReportPdf').mockImplementation(() => undefined);
    csv = jest.spyOn(exporter, 'exportReportCsv').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(FatPdfResultComponent);
    component = fixture.componentInstance;
    localStorage.setItem('name', 'Alex');
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('name');
    jest.restoreAllMocks();
  });

  it('goes back to the project list when no units have been chosen', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    open([]);
    expect(navigate).toHaveBeenCalledWith('/FAT-project-list');
    expect(component.report).toBeNull();
  });

  it('builds the report once the phase name is known', () => {
    open(docs);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);
    expect(component.report.title).toBe('P1 - Phase 1');
    expect(component.report.generatedBy).toBe('Alex');
    expect(component.report.totals.failed).toBe(1);
  });

  it('still builds the report, named by the phase id, if the phase name cannot be found', () => {
    open(docs);
    http.expectOne('/api/fat-project/P1/ph1').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.report.title).toBe('P1 - ph1');
  });

  it('exports the PDF and the CSV from the same report, one at a time', fakeAsync(() => {
    open(docs);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);

    component.exportPdf();
    expect(component.exporting).toBe('pdf');
    // A second export cannot start while one is running.
    component.exportCsv();
    expect(csv).not.toHaveBeenCalled();
    tick();
    expect(pdf).toHaveBeenCalledTimes(1);
    expect(pdf.mock.calls[0][0].title).toBe('P1 - Phase 1');
    expect(component.exporting).toBe('');

    component.exportCsv();
    tick();
    expect(csv).toHaveBeenCalledTimes(1);
    expect(component.exportError).toBe('');
  }));

  it('says so when an export fails, and can be tried again', fakeAsync(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    open(docs);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);
    pdf.mockImplementationOnce(() => { throw new Error('canvas failed'); });

    component.exportPdf();
    tick();
    expect(component.exportError).toContain('The PDF could not be created');
    expect(component.exporting).toBe('');

    component.exportPdf();
    tick();
    expect(component.exportError).toBe('');
    expect(pdf).toHaveBeenCalledTimes(2);
  }));

  it('does nothing before the report is ready', fakeAsync(() => {
    component.exportPdf();
    tick();
    expect(pdf).not.toHaveBeenCalled();
  }));
});
