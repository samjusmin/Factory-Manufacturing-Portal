import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { IStockkeeping, StockState, summariseStock } from '@webproject/data';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

export type StockFilter = 'All' | StockState;

@Component({
  selector: 'webproject-stockkeeping',
  templateUrl: './stockkeeping.component.html',
  styleUrls: ['./stockkeeping.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class StockkeepingComponent implements OnInit {

  dataSource = new MatTableDataSource<IStockkeeping>();
  displayedColumns = [];
  expandedElement: IStockkeeping | null = null;
  isLoaded = false;

  // Filters combine: the text search and the status button.
  searchText = '';
  statusFilter: StockFilter = 'All';
  readonly stateFilters: StockFilter[] = ['All', 'Out of stock', 'Low stock', 'In stock'];

  @ViewChild(MatSort) sort: MatSort;

  /**
   * Pre-defined columns for SKU list
   */
  columnNames = [
    { id: 'no', value: 'Item No.' },
    { id: 'description', value: 'Description' },
    { id: 'variant', value: 'Variant' },
    { id: 'location', value: 'Location' },
    { id: 'state', value: 'Status' },
    { id: 'inventory', value: 'On Hand' },
    { id: 'reorder_point', value: 'Reorder At' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.displayedColumns = this.columnNames.map((x) => x.id);
    this.createTable();
  }

  applyFilter(filterValue: string) {
    this.searchText = (filterValue || '').trim().toLowerCase();
    this.refilter();
  }

  setStatusFilter(status: StockFilter) {
    this.statusFilter = status;
    this.refilter();
  }

  // Material only re-runs the predicate when the filter string changes, so encode every active filter in it.
  private refilter() {
    this.dataSource.filter = [this.searchText, this.statusFilter].join('|');
  }

  // How many items each status button would show, for the counts on the buttons.
  countByState(status: StockFilter): number {
    return this.dataSource.data.filter(i => status === 'All' || (i.summary && i.summary.state === status)).length;
  }

  stateClass(status: string): string {
    return 'state-' + (status || 'in stock').toLowerCase().replace(/\s+/g, '-');
  }

  toggleRow(element: IStockkeeping) {
    this.expandedElement = this.expandedElement === element ? null : element;
  }

  createTable() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<IStockkeeping[]>('/api/stockkeeping', httpOptions)
      .subscribe((skus) => {
        skus.forEach(s => s.summary = summariseStock(s));
        this.dataSource = new MatTableDataSource<IStockkeeping>(skus);
        this.setPredicate();
        this.dataSource.sort = this.sort;
        this.statusFilter = 'All';
        this.searchText = '';
        this.isLoaded = true;
      },
      (error) => {
        throw error;
      });
  }

  private setPredicate() {
    this.dataSource.filterPredicate = (data: IStockkeeping) => {
      if (this.statusFilter !== 'All' && (!data.summary || data.summary.state !== this.statusFilter)) {
        return false;
      }
      if (!this.searchText) {
        return true;
      }
      return [data.no, data.description, data.variant, data.location].join(' ').toLowerCase().indexOf(this.searchText) !== -1;
    };
    // Problem items sort first: out of stock, then low, then fine.
    const stateOrder = { 'Out of stock': 0, 'Low stock': 1, 'In stock': 2 };
    this.dataSource.sortingDataAccessor = (data: IStockkeeping, header: string) => {
      switch (header) {
        case 'state': return data.summary ? stateOrder[data.summary.state] : 3;
        case 'reorder_point': return typeof data.reorder_point === 'number' ? data.reorder_point : -1;
        default: return data[header];
      }
    };
  }

}
