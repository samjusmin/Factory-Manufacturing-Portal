import { Component, OnInit, Renderer2, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { ProdTableService } from '../prod-table.service';

@Component({
  selector: 'webproject-prod-subassembly-table',
  templateUrl: './prod-subassembly-table.component.html',
  styleUrls: ['./prod-subassembly-table.component.css']
})
export class ProdSubassemblyTableComponent implements OnInit {

  subColumns = [];

  assemblyColumns = [
    {
      id: 'line_no',
      value: 'Line No.'
    },
    {
      id: 'item_no',
      value: 'Item No.'
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
      id: 'qty',
      value: 'Quantity'
    },
    {
      id: 'result',
      value: 'Source'
    },
    {
      id: 'qty_received',
      value: 'Qty Completed'
    },
    {
      id: 'qty_to_receive',
      value: 'Qty to Complete'
    },
  ];

  @ViewChild(MatSort, {static: false}) set content(sort: MatSort) {
    this.prodTableService.childSource.sort = sort;
    // this.prodTableService.childSource.sortingDataAccessor = (item, property) => {
    //   if (property.includes('.')) return property.split('.').reduce((o,i)=>o[i], item);
    //   return item[property];
    // };
  }

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

    this.prodTableService.getSubAssembly(routePaths[2]);

    this.subColumns = this.assemblyColumns.map((x) => x.id);

  }

}
