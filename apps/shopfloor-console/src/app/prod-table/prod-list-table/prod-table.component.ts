import { Component, OnInit, ChangeDetectorRef, ViewChild, Renderer2 } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { IProdOrder, ProdState } from '@webproject/data';
import { MatTableDataSource } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { ProdTableService } from '../prod-table.service';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Component({
  selector: 'webproject-prod-table',
  templateUrl: './prod-table.component.html',
  styleUrls: ['./prod-table.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
    trigger('iconExpand', [
      state('default', style({ transform: 'rotate(0)' })),
      state('rotated', style({ transform: 'rotate(-45deg)' })),
      transition('rotated => default', animate('400ms ease-out')),
      transition('default => rotated', animate('400ms ease-in'))
    ]),
  ],
})
export class ProdTableComponent implements OnInit {

  displayedColumns = [];
  subColumns = [];
  expandedElement: IProdOrder | null;
  
  readonly stateFilters: Array<'All' | ProdState> = ['All', 'Not started', 'In progress', 'Completed'];

  columnNames = [
    {
      id: 'doc_no',
      value: 'No.'
    },
    {
      id: 'item_no',
      value: 'Item No.'
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
      id: 'state',
      value: 'Status'
    },
    {
      id: 'progress',
      value: 'Progress'
    },
    {
      id: 'result',
      value: 'PO No.'
    },
    {
      id: 'expected_due_date',
      value: 'Expected Due Date'
    }
  ];

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
      id: 'location',
      value: 'Location'
    },
    {
      id: 'qty',
      value: 'Qty'
    },
    {
      id: 'qty_received',
      value: 'Qty Completed'
    },
  ];

  constructor(
    public prodTableService: ProdTableService,
    private cd: ChangeDetectorRef,
    private renderer: Renderer2
  ) { 
    prodTableService.renderer = renderer;
    prodTableService.isLoaded = false;
  }

  ngOnInit() {
    this.displayedColumns = this.columnNames.map((x) => x.id);
    this.subColumns = this.assemblyColumns.map((x) => x.id);

    const routeURL = this.prodTableService.router.url;
    //const routePaths = routeURL.split("/", 4);

    this.prodTableService.getAllAssemblies();
  }

  toggleRow(element: IProdOrder) {
    this.expandedElement = this.expandedElement === element ? null : element;
    this.cd.detectChanges();
  }

  stateClass(state: string): string {
    return 'state-' + (state || 'not started').toLowerCase().replace(/\s+/g, '-');
  }

  isComplete(needed: any, received: any) {
    if (needed > received) return false;
    return true;
  }

}
