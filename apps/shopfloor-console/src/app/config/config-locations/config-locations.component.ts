import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IConfigLocation } from '@webproject/data';
import { GeneralDialogBoxComponent } from '../../dialog-box/general-dialog/general-dialog-box';
import { DialogBoxConfigLocationsComponent } from '../../dialog-box/config-locations/config-locations-box';
import { ConfigService } from '../config.service';
import { errorMessage, locationSummary } from '../config-view';

// The locations (administrators): add one, or open one to choose which hardware, images and models it can use.
@Component({
  selector: 'webproject-config-locations',
  templateUrl: './config-locations.component.html'
})

export class ConfigLocationsComponent implements OnInit {

  constructor(
    public dialog: MatDialog,
    public ConfigService: ConfigService,
    private snackBar: MatSnackBar,
  ) {
    const source = this.ConfigService.locationDatasource;
    source.sortingDataAccessor = (location, column) => {
      switch (column) {
        case 'images': return (location.image_access || []).length;
        case 'hardware': return (location.hardware_access || []).length;
        case 'access': return (location.item_access || []).length;
        default: return String(location.location || '').toLowerCase();
      }
    };
  }

  displayedColumns: string[] = [];
  readonly locationSummary = locationSummary;

  @ViewChild(MatTable) table: MatTable<IConfigLocation>;

  @ViewChild(MatSort) set sort(sort: MatSort) {
    this.ConfigService.locationDatasource.sort = sort;
  }

  columnNames = [
    { name: 'location', value: 'Location', type: 'string' },
    { name: 'access', value: 'Config access', type: 'string' },
    { name: 'images', value: 'PC images', type: 'string' },
    { name: 'hardware', value: 'Hardware', type: 'string' },
    { name: 'isEdit', value: '', type: 'isEdit' },
  ];

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.name);
    this.load();
  }

  load(): void {
    this.ConfigService.getAllLocations();
  }

  addLocation() {
    const newLocation = <IConfigLocation & { isEdit: boolean }>{"location": "", "item_access": [], isEdit: true};
    this.ConfigService.locationDatasource.data = [newLocation, ...this.ConfigService.locationDatasource.data];
    this.table.renderRows();
  }

  cancelEntry(element: any) {
    // A new array, so the table works its filter out again and the row goes.
    this.ConfigService.locationDatasource.data = this.ConfigService.locationDatasource.data.filter(row => row !== element);
    this.table.renderRows();
  }

  confirmEntry(element: any) {
    if ((element.location || '').trim() === "") {
      this.dialog.open(GeneralDialogBoxComponent,{
        data: {
          title: "Empty Location Field",
          message: "Please enter a Location Name." },
        width: '600px'
      });
    } else {
      const name = element.location.trim();
      this.ConfigService.addNewLocation(name).subscribe(
        () => {
          element.isEdit = false;
          element.location = name;
          // Show the saved location (with its projects and access) rather than the row that was typed.
          this.ConfigService.getAllLocations();
        },
        (error) => {
          if (error && error.status === 401) {
            throw error;
          }
          this.snackBar.open(errorMessage(error, 'That location could not be added. Please try again.'), 'OK', { duration: 8000 });
        }
      );
    }
  }

  applyFilter(filterValue: string) {
    this.ConfigService.locationDatasource.filter = filterValue.trim().toLowerCase();
  }

  openDialogue(element: any) {
    this.dialog.open(DialogBoxConfigLocationsComponent, {
      width: '400px',
      data: element
    });
  }

}
