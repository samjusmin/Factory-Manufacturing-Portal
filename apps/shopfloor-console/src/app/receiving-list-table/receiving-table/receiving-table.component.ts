import { Component, OnInit, ChangeDetectorRef, Renderer2  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { IPurchaseOrder, POState, PODueBucket } from '@webproject/data';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ReceivingTableService } from '../receiving-table.service';

export type ListMode = 'orders' | 'receiving';

@Component({
  selector: 'webproject-receiving-table',
  templateUrl: './receiving-table.component.html',
  styleUrls: ['./receiving-table.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class ReceivingTableComponent implements OnInit {

  // Orders is a tracker of every purchase order; Receiving is the work list of orders still to be received.
  mode: ListMode = 'receiving';

  displayedColumns = [];
  expandedColumns = [];
  expandedElement: IPurchaseOrder | null;
  row: any;

  /**
   * Columns for the Orders tracker: where does each order stand?
   */
  readonly ordersColumns = [
    { id: 'doc_no', value: 'No.' },
    { id: 'vendor', value: 'Vendor Name' },
    { id: 'project', value: 'Project' },
    { id: 'state', value: 'Status' },
    { id: 'progress', value: 'Received' },
    { id: 'expected_due_date', value: 'Due Date' }
  ];

  /**
   * Columns for the Receiving work list: what is arriving, and what needs booking in?
   */
  readonly receivingColumns = [
    { id: 'doc_no', value: 'No.' },
    { id: 'vendor', value: 'Vendor Name' },
    { id: 'project', value: 'Project' },
    { id: 'expected_due_date', value: 'Due Date' },
    { id: 'open_lines', value: 'Lines To Receive' },
    { id: 'shipping_ref', value: 'Last Shipping Ref' }
  ];

  columnNames = this.receivingColumns;

  readonly stateFilters: Array<'All' | POState> = ['All', 'Open', 'On order', 'Partially received', 'Received'];
  readonly bucketFilters: Array<{ id: 'All' | PODueBucket, label: string }> = [
    { id: 'All', label: 'All' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'this-week', label: 'Due this week' },
    { id: 'later', label: 'Later' }
  ];

  /**
   * Pre-defined columns for the lines of an order (the expandable row)
   */
   summaryColumns = [
    { id: 'item_no', value: 'Item No' },
    { id: 'description', value: 'Description' },
    { id: 'revision', value: 'Revision' },
    { id: 'location', value: 'Location' },
    { id: 'qty', value: 'Quantity' },
    { id: 'qty_received', value: 'Qty Received' },
    { id: 'qty_remaining', value: 'Qty Remaining' },
    { id: 'project', value: 'Project' },
    { id: 'prod_order', value: 'Production Order' },
  ];


  constructor(
    public receivingTableService: ReceivingTableService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {
    receivingTableService.renderer = renderer;
    receivingTableService.isLoaded = false;
    receivingTableService.isOrder = false;
    receivingTableService.isReceiving = false;
  }

  ngOnInit() {
    this.mode = this.route.snapshot.data['mode'] === 'orders' ? 'orders' : 'receiving';
    this.columnNames = this.mode === 'orders' ? this.ordersColumns : this.receivingColumns;
    this.displayedColumns = this.columnNames.map((x) => x.id);
    this.expandedColumns = this.summaryColumns.map((x) => x.id);

    if (this.mode === 'orders') {
      this.receivingTableService.getOrderReceiving();
      this.receivingTableService.isOrder = true;
    }
    else {
      this.receivingTableService.getAllReceiving();
      this.receivingTableService.isReceiving = true;
    }
  }

  toggleRow(element: IPurchaseOrder) {
    this.expandedElement = this.expandedElement === element ? null : element;
    this.cd.detectChanges();
  }

  // CSS class for a status chip: "Partially received" -> "state-partially-received".
  stateClass(state: string): string {
    return 'state-' + (state || 'open').toLowerCase().replace(/\s+/g, '-');
  }

  bucketLabel(bucket: PODueBucket | null): string {
    const found = this.bucketFilters.find(b => b.id === bucket);
    return found ? found.label : '';
  }
}
