import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { IFATProject } from 'libs/data/src/lib/fat';
import { FATState, fatState } from '@webproject/data';
import { GeneralDialogBoxComponent } from '../../dialog-box/general-dialog/general-dialog-box';
import { MatDialog } from '@angular/material/dialog';
import { FATProjectService } from '../fat-project.service';

@Component({
  selector: 'webproject-fat-project-list',
  templateUrl: './fat-project-list.component.html',
  styleUrls: ['./fat-project-list.component.css']
})

export class FATProjectListComponent implements OnInit {

  constructor(
    public dialog: MatDialog,
    public FATProjectService: FATProjectService,
  ) {}
  displayedColumns = [];

  readonly stateFilters: Array<'All' | FATState> = ['All', 'Not started', 'In progress', 'Complete'];

  @ViewChild(MatTable) table: MatTable<IFATProject>;

  // The sort lives in the page (not the service) so the header arrows work; it is attached when the table appears,
  // after the list has loaded.
  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this.FATProjectService.attachSort(sort, this.FATProjectService.datasource);
    }
  }

  columnNames = [
    {
      name: 'project',
      value: 'Project',
      type: 'string',
      editable: true,
      isEditing: false
    },
    {
      name: 'description',
      value: 'Description',
      type: 'string',
      editable: true,
      isEditing: false
    },
    {
      name: 'state',
      value: 'Status',
      editable: false,
    },
    {
      name: 'progress',
      value: 'Progress',
      editable: false,
    },
    {
      name: 'isEdit',
      value: '',
      type: 'isEdit',
      required: false
    }
  ];

  ngOnInit(): void {
    this.FATProjectService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.name);
    this.FATProjectService.getAllProjects();
  }

  reload() {
    this.FATProjectService.getAllProjects();
  }

  stateOf(progress: number): FATState {
    return fatState(progress);
  }

  stateClass(progress: number): string {
    return 'state-' + fatState(progress).toLowerCase().replace(/\s+/g, '-');
  }

  addProject() {
    let newProject = <IFATProject>{"project": "", "progress": 0, isEdit: true};
    this.FATProjectService.datasource.data = [newProject, ...this.FATProjectService.datasource.data];
    this.table.renderRows();
  }

  cancelEntry(element: any) {
    // Assign a new array: the sorted table renders from a copy, so mutating the old array in place never reached the screen.
    this.FATProjectService.datasource.data = this.FATProjectService.datasource.data.filter(row => row !== element);
    this.table.renderRows();
  }

  confirmEntry(element: any) {
    const project = (element.project || '').trim();
    const description = (element.description || '').trim();

    if (!project) {
      this.showWarning("Empty Project Field", "Please enter a project code.");
      return;
    }
    if (!description) {
      this.showWarning("Empty Description Field", "Please enter a description for the project.");
      return;
    }
    const duplicate = this.FATProjectService.datasource.data.some(
      (row: any) => row !== element && !row.isEdit && (row.project || '').trim().toLowerCase() === project.toLowerCase()
    );
    if (duplicate) {
      this.showWarning("Project Already Exists", "A project with the code " + project + " already exists.");
      return;
    }

    if (element.saving) {
      return;
    }
    element.saving = true;
    element.project = project;
    element.description = description;
    this.FATProjectService.addNewProject(element).subscribe(
      () => {
        element.saving = false;
        element.isEdit = false;
        this.table.renderRows();
      },
      (error) => {
        // Keep the row open so nothing the user typed is lost; the global handler reports the error.
        element.saving = false;
        throw error;
      }
    );
  }

  private showWarning(title: string, message: string) {
    this.dialog.open(GeneralDialogBoxComponent, { data: { title, message } });
  }
}
