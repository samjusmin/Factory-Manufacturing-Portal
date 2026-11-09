import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HardwareType } from '@webproject/data';
import { ConfigService } from '../config.service';
import { errorMessage, filterOptions, matchesFilters, matchesTerm } from '../config-view';
import { IListFilterGroup, IListFilterSelection } from '../../shared/list-filters/list-filters.component';
import { GeneralDialogBoxComponent } from '../../dialog-box/general-dialog/general-dialog-box';

// The hardware models a location can pick from (administrators): a name and the kind of hardware it is.
@Component({
  selector: 'webproject-config-hardware-list',
  templateUrl: './config-hardware-list.component.html'
})

export class ConfigHardwareListComponent implements OnInit {

  @ViewChild(MatTable) table: MatTable<HardwareType>;

  @ViewChild(MatSort) set sort(sort: MatSort) {
    this.ConfigService.hardwareList.sort = sort;
  }

  constructor(
    public ConfigService: ConfigService,
    public dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {  }
  displayedColumns = [];

  // The categories an item of hardware can belong to: whatever the catalogue has.
  configTypes: string[] = [];
  saving = false;

  term = '';
  selection: IListFilterSelection = {};

  // The filter choices are worked out again only when the categories change.
  private groupsTypes: string[] | null = null;
  private cachedGroups: IListFilterGroup[] = [];

  columnNames = [
    {
      id: 'name',
      value: 'Name',
      type: 'string',
      editable: true,
      required: true
    },
    {
      id: 'config_type',
      value: 'Config type',
      type: 'Array',
      editable: true,
      required: true
    },
    {
      id: 'isEdit',
      value: '',
      type: 'isEdit',
      required: false
    },
  ];

  ngOnInit() {
    this.ConfigService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.id);
    // A row being added or edited always stays in view, whatever is filtered.
    this.ConfigService.hardwareList.filterPredicate = (hardware: any) =>
      hardware.isEdit || (matchesFilters(hardware, this.selection) && matchesTerm([hardware.name].concat(hardware.config_type).join(' '), this.term));
    this.refilter();
    this.ConfigService.getCatalogue().subscribe(catalogue => this.configTypes = catalogue.categories.map(c => c.name));
    this.load();
  }

  load() {
    this.ConfigService.getHardwareList();
  }

  detectChanges() {
    this.cd.detectChanges();
  }

  saveChanges(element: any) {

    const missingFields = this.columnNames.filter(col => col.required).filter(col => !element[col.id]?.toString().trim())

    if (missingFields.length > 0) {
      this.dialog.open(GeneralDialogBoxComponent,{
        data: {
          title: "Empty Fields",
          message: 'Please fill in all required fields.\n\n' + missingFields.map(x => ` • ${x.value}`).join('\n')
        }
      });
      return;
    }

    this.saving = true;
    this.ConfigService.updateHardwareUnits(element).subscribe(
      () => {
        this.saving = false;
        element.isEdit = false;
        this.ConfigService.getHardwareList();
        this.detectChanges();
      },
      (error) => this.saveFailed(error)
    );
  }

  // The server says why it refused (a name already used, a category that does not exist...); the row stays open to fix.
  private saveFailed(error: any) {
    this.saving = false;
    if (error && error.status === 401) {
      throw error;
    }
    this.snackBar.open(errorMessage(error, 'That could not be saved. Please try again.'), 'OK', { duration: 8000 });
  }

  cancelEntry(element: any) {
    if (!element._id) {
      // A new array, so the table works its filter out again and the row goes.
      this.ConfigService.hardwareList.data = this.ConfigService.hardwareList.data.filter(row => row !== element);
      this.table.renderRows();
    }
    else {
      element.isEdit = false;
      this.ConfigService.getHardwareList();
      this.table.renderRows();
    }
  }

  addImage() {
      const newHardware = <HardwareType>{
        name: '',
        config_type: [],
        isEdit: true
      };
      this.ConfigService.hardwareList.data = [newHardware, ...this.ConfigService.hardwareList.data];
      this.table.renderRows();
  }

  private refilter() {
    // The table only re-runs its filter when this value changes.
    this.ConfigService.hardwareList.filter = JSON.stringify([this.term, this.selection]);
  }

  applyFilter(filterValue: string) {
    this.term = filterValue;
    this.refilter();
  }

  setSelection(selection: IListFilterSelection) {
    this.selection = selection;
    this.refilter();
  }

  clearFilters() {
    this.setSelection({});
  }

  get hasFilters(): boolean {
    return Object.keys(this.selection).some(key => this.selection[key].length > 0);
  }

  get filterGroups(): IListFilterGroup[] {
    if (this.groupsTypes !== this.configTypes) {
      this.groupsTypes = this.configTypes;
      this.cachedGroups = [{ key: 'config_type', title: 'Config type', options: filterOptions(this.configTypes) }];
    }
    return this.cachedGroups;
  }

  editRow(element: any) {
    element.isEdit = true;
  }

}
