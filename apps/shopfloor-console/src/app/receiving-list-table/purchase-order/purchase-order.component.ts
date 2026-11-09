import { Component, OnInit, ChangeDetectorRef, Renderer2  } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { IPurchaseOrder } from '@webproject/data';
import { MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ReceivingTableService } from '../receiving-table.service';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Component({
  selector: 'webproject-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class PurchaseOrderComponent implements OnInit {

  displayedColumns = [];
  expandedColumns = [];
  expandedElement: IPurchaseOrder | null;

  // @ViewChild(MatSort) sort: MatSort;

  /**
   * Pre-defined columns for PO list
   */
  columnNames = [
    {
      id: 'doc_no',
      value: 'No.'
    },
    {
      id: 'vendor',
      value: 'Vendor Name'
    },
    {
      id: 'project',
      value: 'Project'
    },
    {
      id: 'location',
      value: 'Location'
    },
    {
       id: 'expected_due_date',
       value: 'Due Date'
    }
  ];

  /**
   * Pre-defined columns for dropdown fields
   */
   summaryColumns = [
    {
      id: 'item_no',
      value: 'Item No'
    },
    {
      id: 'description',
      value: 'Description'
    },
    {
      id: 'revision',
      value: 'Revision'
    },
    {
      id: 'location',
      value: 'Location'
    },
    {
      id: 'qty',
      value: 'Quantity'
    },
    {
      id: 'project',
      value: 'Project'
    },
    {
      id: 'prod_order',
      value: 'Production Order'
    },
    {
      id: 'qty_received',
      value: 'Qty Already Received'
    },
  ];

  constructor(
    public receivingTableService: ReceivingTableService,
    private cd: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {
    receivingTableService.renderer = renderer;
    receivingTableService.isLoaded = false;
  }

  ngOnInit() {
    this.displayedColumns = this.columnNames.map((x) => x.id);
    this.expandedColumns = this.summaryColumns.map((x) => x.id);

    const routeURL = this.receivingTableService.router.url;
    const routePaths = routeURL.split("/", 2);

    console.log("Route", routePaths);
    if (routePaths[1] == "receiving") {
      this.receivingTableService.getAllReceiving();
    }
    else if (routePaths[1] == "orders") {
      this.receivingTableService.getOrderReceiving();
    }
  }

  toggleRow(element: IPurchaseOrder) {
    this.expandedElement = this.expandedElement === element ? null : element;
    this.cd.detectChanges();
  }

}
