import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { FATState, fatState } from '@webproject/data';
import { FATUnit } from 'libs/data/src/lib/fat';
import { FATProjectService } from '../fat-project.service';

@Component({
  selector: 'webproject-fat-unit-list',
  templateUrl: './fat-unit-list.component.html',
  styleUrls: ['./fat-unit-list.component.css']
})

export class FATUnitListComponent implements OnInit {

  constructor(
    public FATProjectService: FATProjectService,
  ) { }
  displayedColumns = [];

  readonly stateFilters: Array<'All' | FATState> = ['All', 'Not started', 'In progress', 'Complete'];

  @ViewChild(MatTable) table: MatTable<FATUnit>;

  // The sort lives in the page (not the service) so the header arrows work; it is attached when the table appears.
  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this.FATProjectService.attachSort(sort, this.FATProjectService.unitsource);
    }
  }

  columnNames = [
    {
      name: 'doc_no',
      value: 'PC'
    },
    {
      name: 'unit_no',
      value: 'Unit'
    },
    {
      name: 'location',
      value: 'Location'
    },
    {
      name: 'unit_type',
      value: 'Type'
    },
    {
      name: 'state',
      value: 'Status'
    },
    {
      name: 'progress',
      value: 'Progress'
    },
    {
      name: 'open',
      value: 'Open checks'
    }
  ];

  ngOnInit(): void {
    this.FATProjectService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.name);
    // this.fatSource = new MatTableDataSource<FATUnit>(res);
    // console.log(this.fatSource)


    this.displayedColumns = this.columnNames.map((x) => x.name);

    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    console.log("This is the route")
    console.log(routePaths)

    let project = routePaths[2].replace(/\%20/g, " ");
    let phase = routePaths[3].replace(/\%20/g, " ");

    console.log(project);
    console.log(phase);
    this.FATProjectService.getAllProjectPhaseUnits(project, phase);
    this.FATProjectService.getPhaseOutstanding(project, phase);
    this.FATProjectService.getPhaseName(project, phase);
  }

  reload() {
    this.FATProjectService.getAllProjectPhaseUnits(this.getProject(), this.getPhase());
    this.FATProjectService.getPhaseOutstanding(this.getProject(), this.getPhase());
  }

  // Totals across the phase for the line above the table.
  get totals() {
    const checks = Object.keys(this.FATProjectService.unitChecks).map(k => this.FATProjectService.unitChecks[k]);
    return {
      outstanding: checks.reduce((sum, c) => sum + c.outstanding, 0),
      failed: checks.reduce((sum, c) => sum + c.failed, 0),
      unitsWithFailures: checks.filter(c => c.failed > 0).length,
    };
  }

  stateOf(progress: number): FATState {
    return fatState(progress);
  }

  stateClass(progress: number): string {
    return 'state-' + fatState(progress).toLowerCase().split(' ').join('-');
  }

  getProject() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    return routePaths[2].replace(/\%20/g, " ");
  }

  getPhase() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    //let project = routePaths[2].replace(/\%20/g, " ");
    let phaseID = routePaths[3];
    return phaseID.replace(/\%20/g, " ");

    //phaseName = this.FATProjectService.getPhaseName(project, phaseID);

  }  

}
