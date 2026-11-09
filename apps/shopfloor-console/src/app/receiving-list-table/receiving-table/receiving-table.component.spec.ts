import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';

import { ReceivingTableComponent, ListMode } from './receiving-table.component';
import { ReceivingTableService } from '../receiving-table.service';

const summary = (state: string, bucket: string | null, overdue = false) => ({
  state, bucket, overdue, percent_received: state === 'Received' ? 100 : 0,
  qty_total: 10, qty_received: state === 'Received' ? 10 : 0, total_lines: 1, open_lines: state === 'Received' ? 0 : 1,
  days_late: overdue ? 2 : 0,
});

const orders = [
  { doc_no: 'PO-1', vendor: 'Apex Components', status: 'Released', items: [], summary: summary('On order', 'overdue', true) },
  { doc_no: 'PO-2', vendor: 'Brightline Electronics', status: 'Released', items: [], summary: summary('Received', null) },
  { doc_no: 'PO-3', vendor: 'Summit Fasteners', status: 'Open', items: [], summary: summary('Open', null) },
  { doc_no: 'PO-4', vendor: 'Apex Components', status: 'Released', items: [], summary: summary('On order', 'this-week') },
];

describe('ReceivingTableComponent', () => {
  let http: HttpTestingController;
  let service: ReceivingTableService;

  async function create(mode: ListMode): Promise<ComponentFixture<ReceivingTableComponent>> {
    await TestBed.configureTestingModule({
      declarations: [ReceivingTableComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: { mode } } } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ReceivingTableService);
    const fixture = TestBed.createComponent(ReceivingTableComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('Orders loads the tracker list and shows status and progress columns', async () => {
    const component = (await create('orders')).componentInstance;
    http.expectOne('/api/purchase-order/orders').flush(orders);
    expect(component.mode).toBe('orders');
    expect(component.displayedColumns).toEqual(['doc_no', 'vendor', 'project', 'state', 'progress', 'expected_due_date']);
    expect(service.dataSource.data.length).toBe(4);
  });

  it('Receiving loads the work list and shows lines-to-receive, not status', async () => {
    const component = (await create('receiving')).componentInstance;
    http.expectOne('/api/purchase-order').flush(orders.filter(o => o.summary.state !== 'Received'));
    expect(component.mode).toBe('receiving');
    expect(component.displayedColumns).toContain('open_lines');
    expect(component.displayedColumns).not.toContain('state');
  });

  it('narrows the Orders list by status and counts each status', async () => {
    await create('orders');
    http.expectOne('/api/purchase-order/orders').flush(orders);
    expect(service.countByState('All')).toBe(4);
    expect(service.countByState('On order')).toBe(2);
    service.setStatusFilter('Received');
    expect(service.dataSource.filteredData.map(o => o.doc_no)).toEqual(['PO-2']);
    service.setStatusFilter('All');
    expect(service.dataSource.filteredData.length).toBe(4);
  });

  it('combines the overdue toggle with the text search', async () => {
    await create('orders');
    http.expectOne('/api/purchase-order/orders').flush(orders);
    service.toggleOverdueOnly();
    expect(service.dataSource.filteredData.map(o => o.doc_no)).toEqual(['PO-1']);
    service.applyFilter('summit');
    expect(service.dataSource.filteredData).toEqual([]);
    service.applyFilter('apex');
    expect(service.dataSource.filteredData.map(o => o.doc_no)).toEqual(['PO-1']);
  });

  it('narrows the Receiving list by due-date bucket', async () => {
    await create('receiving');
    http.expectOne('/api/purchase-order').flush(orders.filter(o => o.summary.state === 'On order'));
    expect(service.countByBucket('overdue')).toBe(1);
    service.setBucketFilter('this-week');
    expect(service.dataSource.filteredData.map(o => o.doc_no)).toEqual(['PO-4']);
  });

  it('turns a status into a CSS class', async () => {
    const component = (await create('orders')).componentInstance;
    http.expectOne('/api/purchase-order/orders').flush([]);
    expect(component.stateClass('Partially received')).toBe('state-partially-received');
  });
});
