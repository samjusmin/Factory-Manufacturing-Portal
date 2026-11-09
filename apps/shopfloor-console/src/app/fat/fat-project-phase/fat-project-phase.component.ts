import { Component, OnInit, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { FATState, fatState } from '@webproject/data';
import { GeneralDialogBoxComponent } from '../../dialog-box/general-dialog/general-dialog-box';
import { IFATPhase } from 'libs/data/src/lib/fat';
import { FATProjectService } from '../fat-project.service';

@Component({
  selector: 'webproject-fat-project-phase',
  templateUrl: './fat-project-phase.component.html',
  styleUrls: ['./fat-project-phase.component.css'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
  // animations: [
  //   trigger('detailExpand', [
  //     state('collapsed', style({ height: '0px', minHeight: '0' })),
  //     state('expanded', style({ height: '*' })),
  //     transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
  //   ]),
  //   trigger('iconExpand', [
  //     state('default', style({ transform: 'rotate(0)' })),
  //     state('rotated', style({ transform: 'rotate(-45deg)' })),
  //     transition('rotated => default', animate('400ms ease-out')),
  //     transition('default => rotated', animate('400ms ease-in'))
  //   ]),
  // ],
})

export class FATProjectPhaseComponent implements OnInit {

  @ViewChild(MatTable) table: MatTable<IFATPhase>;

  readonly stateFilters: Array<'All' | FATState> = ['All', 'Not started', 'In progress', 'Complete'];

  // The sort lives in the page (not the service) so the header arrows work; it is attached when the table appears.
  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this.FATProjectService.attachSort(sort, this.FATProjectService.phasesource);
    }
  }

  constructor(
    public FATProjectService: FATProjectService,
    private cd: ChangeDetectorRef,
    private dialog: MatDialog,
  ) { }
  displayedColumns = [];
  renderer;

  columnNames = [
    {
      id: 'name',
      value: 'Phase',
      type: 'string',
      editable: true,
      required: true
    },
    {
      id: 'state',
      value: 'Status',
      type: 'string',
      editable: false,
      required: false
    },
    {
      id: 'progress',
      value: 'Progress',
      type: 'string',
      editable: false,
      required: true
    },
    {
      id: 'isEdit',
      value: '',
      type: 'isEdit',
      required: false
    }, 
  ];

  ngOnInit(): void {
    this.FATProjectService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.id);
    // let res = [
    //   {phase: 'Phase 1 - x15 S3T2', progress: 100},
    //   {phase: 'Phase 2 - 5x Unit X1', progress: 60},
    //   {phase: 'Phase 2 - 2x Unit Z', progress: 20},
    //   {phase: 'Phase 3 - x100 Unit Z-C', progress: 0},
    // ];
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 3);
    console.log("This is the route")
    console.log(routePaths)
    this.FATProjectService.getProjectPhases(routePaths[2].replace(/\%20/g, " "));
  }


  reload() {
    this.FATProjectService.getProjectPhases(this.getProject());
  }

  stateOf(progress: number): FATState {
    return fatState(progress);
  }

  stateClass(progress: number): string {
    return 'state-' + fatState(progress).toLowerCase().split(' ').join('-');
  }

  detectChanges() {
    this.cd.detectChanges();
    this.table.renderRows;
  }

  isPhase(type: string) {
    if (type == 'name') {
      return true;
    }
    else {
      return false;
    }
  }

  progressColour(progress: number) {
    if (progress == 100) {
      return true;
    }
    else {
      return false;
    }
  }

  // addProject() {
  //   console.log("new project being added");
  //   let newProject = <FATPhase>{"phase": "", "progress": 0, isEdit: true};
  //   this.fatSource.data.push(newProject)
  //   this.table.renderRows();
  // }

  getProject() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 3);
    return routePaths[2].replace(/\%20/g, " ");
  }

  editRow(element: any) {
    console.log("HERE IS THE ELEMENT WHEN ROW IS BEING EDITED");
    console.log(element);

    if (!(element.name || '').trim()) {
      this.dialog.open(GeneralDialogBoxComponent, {
        data: { title: 'Phase name is empty', message: 'Please enter a name for the phase.' },
      });
    } else {
      console.log("Test ", element);
      var proj = this.getProject();
      this.FATProjectService.setPhaseName(proj, element.id, element.name);
      element.isEdit = !element.isEdit;
      this.FATProjectService.getProjectPhases(proj, true);
      // this.getAllTrainReg();
      this.detectChanges();
    }
    
  }

}
