import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ProdTableComponent } from './prod-table.component';
import { ProdTableService } from '../prod-table.service';

const summary = (state: string, percent: number, overdue = false) => ({
  state, percent_complete: percent, qty_total: 10, qty_complete: percent / 10, overdue, days_late: overdue ? 3 : 0,
});

const order = (doc_no: string, description: string, s: any, po?: string) => ({
  doc_no, description, project: 'PRJ-ALPHA', location: 'WH-SYD-A1', parent_ref: 0, status: 'Released',
  items: [{ item_no: 'FG-' + doc_no, qty: 10 }], result: po ? [{ doc_no: po }] : [], summary: s,
});

const orders = [
  order('MRP-1', 'Pulse Unit', summary('Not started', 0, true)),
  order('MRP-2', 'Frame sub-assembly', summary('Not started', 0), 'PO-9'),
  order('MRP-3', 'Electronics tray', summary('Completed', 100)),
  order('MRP-4', 'Pulse Unit Z', summary('In progress', 40)),
];

describe('ProdTableComponent', () => {
  let http: HttpTestingController;
  let service: ProdTableService;
  let fixture: ComponentFixture<ProdTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProdTableComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProdTableService);
    fixture = TestBed.createComponent(ProdTableComponent);
    fixture.detectChanges();
    http.expectOne('/api/prod-order/').flush(orders);
  });

  afterEach(() => http.verify());

  it('shows status and progress columns and no quantity column', () => {
    const ids = fixture.componentInstance.displayedColumns;
    expect(ids).toContain('state');
    expect(ids).toContain('progress');
    expect(ids).not.toContain('qty');
  });

  it('counts the orders behind each status button', () => {
    expect(service.countByState('All')).toBe(4);
    expect(service.countByState('Not started')).toBe(2);
    expect(service.countByState('In progress')).toBe(1);
    expect(service.countByState('Completed')).toBe(1);
  });

  it('narrows the list by status and by overdue, and the two combine', () => {
    service.setStatusFilter('Not started');
    expect(service.mrpSource.filteredData.map(o => o.doc_no)).toEqual(['MRP-1', 'MRP-2']);
    service.toggleOverdueOnly();
    expect(service.mrpSource.filteredData.map(o => o.doc_no)).toEqual(['MRP-1']);
    service.toggleOverdueOnly();
    service.setStatusFilter('All');
    expect(service.mrpSource.filteredData.length).toBe(4);
  });

  it('searches the order, item, description and linked purchase order, together with the buttons', () => {
    service.applyFilter('po-9');
    expect(service.mrpSource.filteredData.map(o => o.doc_no)).toEqual(['MRP-2']);
    service.applyFilter('fg-mrp-4');
    expect(service.mrpSource.filteredData.map(o => o.doc_no)).toEqual(['MRP-4']);
    service.setStatusFilter('Completed');
    expect(service.mrpSource.filteredData.length).toBe(0);
  });

  it('sorts by progress and by status order', () => {
    const accessor = service.mrpSource.sortingDataAccessor;
    expect(accessor(orders[3] as any, 'progress')).toBe(40);
    expect(accessor(orders[2] as any, 'state')).toBeGreaterThan(accessor(orders[3] as any, 'state') as number);
  });

  it('builds a css class for the status chip', () => {
    expect(fixture.componentInstance.stateClass('In progress')).toBe('state-in-progress');
  });
});
