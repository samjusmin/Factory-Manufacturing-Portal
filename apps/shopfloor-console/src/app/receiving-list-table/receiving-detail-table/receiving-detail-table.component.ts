import { Component, OnInit, ViewEncapsulation, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReceivingTableService } from '../receiving-table.service';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'webproject-receiving-detail-table',
  templateUrl: './receiving-detail-table.component.html',
  styleUrls: ['./receiving-detail-table.component.css'],
  encapsulation: ViewEncapsulation.None
})

export class ReceivingDetailTableComponent implements OnInit {

  detailColumns = [];

  // Opened from Orders (/orders/:poId): a read-only view without quantity entry or the Receive button.
  readOnly = false;
  poId: string;

  // Sortable view of the PO lines. The entered quantities stay tied to each line by its original position,
  // so sorting the table never moves a quantity onto a different line.
  private sourceItems: any[];
  private itemsSource = new MatTableDataSource<any>();

  get itemsDataSource(): MatTableDataSource<any> {
    const items = this.receivingTableService.itemSource[0].items;
    if (items !== this.sourceItems) {
      this.sourceItems = items;
      this.itemsSource.data = items || [];
    }
    return this.itemsSource;
  }

  origIndex(item: any): number {
    return this.receivingTableService.itemSource[0].items.indexOf(item);
  }

  //@ViewChild(MatSort, { static: false}) sort: MatSort;
  // @ViewChild(MatSort, {static: false}) set content(sort: MatSort) {
  //   this.receivingTableService.itemSource.sortingDataAccessor = (item, property) => {
  //     switch(property) {
  //       case 'qty': {
  //         return item.items['qty'];
  //       }
  //       default: return item.items[property];
  //     }
  //   }
  //   this.receivingTableService.itemSource.sort = sort;
  // }
  /**
   * Pre-defined columns for PO items
   */
   itemColumns = [
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
      id: 'qty',
      value: 'Quantity'
    },
    {
      id: 'qty_received',
      value: 'Qty Received'
    },
    {
      id: 'qty_remaining',
      value: 'Qty Remaining'
    },
    // Next to the remaining quantity so the input is on screen without scrolling sideways.
    {
      id: 'qty_to_receive',
      value: 'Qty To Receive'
    },
    {
      id: 'project',
      value: 'Project'
    },
    {
      id: 'prod_order',
      value: 'Prod. Order'
    },
    {
      id: 'expected_due_date',
      value: 'Due Date'
    }
  ];

  constructor(
    public receivingTableService: ReceivingTableService,
    private route: ActivatedRoute,
  ) { 
    receivingTableService.isLoaded = false;
  }

  ngOnInit() {
    this.readOnly = this.route.snapshot.data['readOnly'] === true;
    this.poId = this.route.snapshot.paramMap.get('poId');

    this.receivingTableService.getReceivingOrder(this.poId, this.readOnly);

    this.detailColumns = this.itemColumns
      .filter(x => !(this.readOnly && x.id === 'qty_to_receive'))
      .map((x) => x.id);
  }

  // CSS class for the status chip: "Partially received" -> "state-partially-received".
  stateClass(state: string): string {
    return 'state-' + (state || 'open').toLowerCase().replace(/\s+/g, '-');
  }
}
