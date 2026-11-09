import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { StockkeepingComponent } from './stockkeeping.component';

const item = (no: string, description: string, inventory: number, reorder_point: number | null = 10, reorder_qty = 20) => ({
  no, description, inventory, reorder_point, reorder_qty, variant: ' ', location: 'WH-SYD-A1', replenishment_system: 'Purchase',
});

const items = [
  item('PCB-1', 'Main controller PCB', 42, 20, 40),
  item('PCB-2', 'Power distribution PCB', 8, 15, 30),
  item('CAB-1', 'Power harness', 0, 25, 50),
  item('FAS-1', 'M4 screw', 31, null),
];

describe('StockkeepingComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<StockkeepingComponent>;
  let component: StockkeepingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StockkeepingComponent],
      imports: [HttpClientTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StockkeepingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/stockkeeping').flush(items);
  });

  afterEach(() => http.verify());

  it('works out a status for every item and counts them for the filter buttons', () => {
    expect(component.countByState('All')).toBe(4);
    expect(component.countByState('In stock')).toBe(2);
    expect(component.countByState('Low stock')).toBe(1);
    expect(component.countByState('Out of stock')).toBe(1);
  });

  it('narrows the list by status', () => {
    component.setStatusFilter('Low stock');
    expect(component.dataSource.filteredData.map(i => i.no)).toEqual(['PCB-2']);
    component.setStatusFilter('All');
    expect(component.dataSource.filteredData.length).toBe(4);
  });

  it('searches number and description and combines with the status button', () => {
    component.applyFilter('pcb');
    expect(component.dataSource.filteredData.map(i => i.no)).toEqual(['PCB-1', 'PCB-2']);
    component.setStatusFilter('Out of stock');
    expect(component.dataSource.filteredData.length).toBe(0);
  });

  it('sorts problem items first when sorting by status', () => {
    const accessor = component.dataSource.sortingDataAccessor;
    const [pcb1, pcb2, cab] = component.dataSource.data;
    expect(accessor(cab, 'state')).toBeLessThan(accessor(pcb2, 'state') as number);
    expect(accessor(pcb2, 'state')).toBeLessThan(accessor(pcb1, 'state') as number);
  });

  it('expands and collapses a row', () => {
    const row = component.dataSource.data[0];
    component.toggleRow(row);
    expect(component.expandedElement).toBe(row);
    component.toggleRow(row);
    expect(component.expandedElement).toBeNull();
  });

  it('builds a css class for the status chip', () => {
    expect(component.stateClass('Out of stock')).toBe('state-out-of-stock');
  });
});
