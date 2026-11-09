import { Component, OnInit, Renderer2, ViewChild } from '@angular/core';
import { ProdTableService } from '../prod-table.service';
import { MatSort, Sort } from '@angular/material/sort';

@Component({
  selector: 'webproject-prod-component-table',
  templateUrl: './prod-component-table.component.html',
  styleUrls: ['./prod-component-table.component.css']
})
export class ProdComponentTableComponent implements OnInit {

  compColumns = [];

  @ViewChild(MatSort, { static: false }) sort: MatSort

  componentColumns = [
    {
      id: 'line_no',
      value: 'Line No.'
    },
    {
      id: 'item_no',
      value: 'Item No'
    },
    {
      id: 'revision',
      value: 'Revision'
    },
    {
      id: 'description',
      value: 'Description'
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
      id: 'qty_per',
      value: 'Qty Per'
    },
    {
      id: 'qty',
      value: 'Qty Needed'
    },
    {
      id: 'qty_received',
      value: 'Qty Consumed'
    },
    {
      id: 'qty_remaining',
      value: 'Qty Remaining'
    },
    {
      id: 'result',
      value: 'Source'
    },
    {
      id: 'vendor',
      value: 'Vendor'
    },
    {
      id: 'stock',
      value: 'Inventory'
    },
    {
      id: 'qty_to_receive',
      value: 'Qty to Consume'
    }
  ];

  constructor(
    public prodTableService: ProdTableService,
    private renderer: Renderer2
  ) { 
    prodTableService.renderer = renderer;
    prodTableService.isLoaded = false;
  }

  ngOnInit() {
    const routeURL = this.prodTableService.router.url;
    const routePaths = routeURL.split("/", 4);

    this.prodTableService.getComponents(routePaths[2], routePaths[3]);

    this.compColumns = this.componentColumns.map((x) => x.id);
  }

  refresh() {
    const routeURL = this.prodTableService.router.url;
    const routePaths = routeURL.split("/", 4);

    this.prodTableService.refreshComponents(routePaths[2], routePaths[3]);

    this.compColumns = this.componentColumns.map((x) => x.id);
  }

  autofill() {
    this.prodTableService.autoFill();
  }

}