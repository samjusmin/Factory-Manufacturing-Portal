import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FATUnitCatComponent } from './fat-unit-cat.component';

const item = (n: number, status: string | null) => ({ category: 'Kiosk Common', description: 'Check ' + n, status, comment: null });
const summary = (failed: number, unanswered: number) => ({
  total: 20, complete: 20 - failed - unanswered, notApplicable: 0, failed, unanswered, outstanding: failed + unanswered,
  items: [
    ...Array.from({ length: failed }, (_, i) => item(i, 'Incomplete')),
    ...Array.from({ length: unanswered }, (_, i) => item(failed + i, null)),
  ],
});

describe('FATUnitCatComponent', () => {
  let http: HttpTestingController;
  let component: FATUnitCatComponent;
  let fixture: ComponentFixture<FATUnitCatComponent>;

  // Answers everything the page asks for on load, with the given answer for the outstanding checks.
  const flushLoad = (outstanding: any, status = 200) => {
    http.match(() => true).forEach(req => {
      if (req.request.url.endsWith('/getOutstanding')) {
        req.flush(outstanding, { status, statusText: status === 200 ? 'OK' : 'Server Error' });
      } else if (req.request.url.endsWith('/adminCheck')) {
        req.flush(true);
      } else if (req.request.url.endsWith('/getUnitComments')) {
        req.flush([{ comment: '' }]);
      } else {
        req.flush([{ name: 'Phase 1', category: [] }]);
      }
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATUnitCatComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-unit-cat/P1/ph1/U1');
    fixture = TestBed.createComponent(FATUnitCatComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  it('loads what is still to do on the unit, failed checks first', async () => {
    const loading = component.ngOnInit();
    flushLoad(summary(2, 3));
    await loading;
    flushLoad(summary(2, 3));
    expect(component.summary.failed).toBe(2);
    expect(component.shownItems.map(i => i.status)).toEqual(['Incomplete', 'Incomplete', null, null, null]);
  });

  it('shows the first few and the rest on request', () => {
    component.summary = summary(3, 12);
    expect(component.shownItems.length).toBe(component.itemLimit);
    component.showAllItems = true;
    expect(component.shownItems.length).toBe(15);
  });

  it('shows nothing, and does not fail, when the summary cannot be loaded', async () => {
    const loading = component.ngOnInit();
    flushLoad({}, 500);
    await loading;
    flushLoad({}, 500);
    expect(component.summary).toBeNull();
    expect(component.shownItems).toEqual([]);
  });
});
