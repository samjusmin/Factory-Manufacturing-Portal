import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FATUnitListComponent } from './fat-unit-list.component';
import { FATProjectService } from '../fat-project.service';

const units = [
  { doc_no: 'U1', unit_no: 'S1', location: 'HQ', unit_type: 'unit-z', progress: 50 },
  { doc_no: 'U2', unit_no: '', location: 'HQ', unit_type: 'unit-z', progress: 100 },
  { doc_no: 'U3', unit_no: '', location: 'HQ', unit_type: 'unit-z', progress: 0 },
];
const counts = (failed: number, unanswered: number) => ({ total: 10, complete: 10 - failed - unanswered, notApplicable: 0, failed, unanswered, outstanding: failed + unanswered });

describe('FATUnitListComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATUnitListComponent;
  let fixture: ComponentFixture<FATUnitListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATUnitListComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-unit-list/P1/ph1');
    fixture = TestBed.createComponent(FATUnitListComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush(units);
    http.expectOne('/api/factory-acceptance-test/P1/ph1/getOutstanding').flush([
      { doc_no: 'U1', ...counts(2, 3) }, { doc_no: 'U2', ...counts(0, 0) }, { doc_no: 'U3', ...counts(0, 10) },
    ]);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);
  });

  afterEach(() => http.verify());

  it('has an open checks column and loads the counts for the phase', () => {
    expect(component.displayedColumns).toContain('open');
    expect(service.unitChecks['U1'].outstanding).toBe(5);
    expect(service.failedCount('U1')).toBe(2);
    expect(service.failedCount('U2')).toBe(0);
    expect(service.failedCount('unknown')).toBe(0);
  });

  it('adds up the checks still to do across the phase', () => {
    expect(component.totals).toEqual({ outstanding: 15, failed: 2, unitsWithFailures: 1 });
    expect(service.unitsWithFailures()).toBe(1);
  });

  it('can show only the units that have a failed check', () => {
    expect(service.unitsource.filteredData.length).toBe(3);
    service.setAttentionOnly(true);
    expect(service.unitsource.filteredData.map(u => u.doc_no)).toEqual(['U1']);
    // It combines with the status buttons.
    service.setStatusFilter('Complete');
    expect(service.unitsource.filteredData.length).toBe(0);
    service.setStatusFilter('All');
    service.setAttentionOnly(false);
    expect(service.unitsource.filteredData.length).toBe(3);
  });

  it('sorts by how many checks are still open', () => {
    const accessor = service.unitsource.sortingDataAccessor as (row: any, header: string) => any;
    expect(accessor(units[0], 'open')).toBe(5);
    expect(accessor(units[1], 'open')).toBe(0);
    expect(accessor({ doc_no: 'none' }, 'open')).toBe(0);
  });

  it('forgets the failed-units filter when a list is loaded again', () => {
    service.setAttentionOnly(true);
    component.reload();
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush(units);
    http.expectOne('/api/factory-acceptance-test/P1/ph1/getOutstanding').flush([]);
    expect(service.attentionOnly).toBe(false);
    expect(service.unitChecks).toEqual({});
  });

  it('leaves the counts blank rather than failing when they cannot be loaded', () => {
    component.reload();
    http.expectOne('/api/factory-acceptance-test/P1/ph1').flush(units);
    http.expectOne('/api/factory-acceptance-test/P1/ph1/getOutstanding').flush('no', { status: 500, statusText: 'Server Error' });
    expect(service.unitChecks).toEqual({});
    expect(service.loadError).toBe(false);
    expect(component.totals.outstanding).toBe(0);
  });
});
