import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigImages } from '@webproject/data';
import { ConfigService } from '../config.service';
import { errorMessage, filterOptions, matchesFilters, matchesTerm, rowFilterOptions } from '../config-view';
import { IListFilterGroup, IListFilterSelection } from '../../shared/list-filters/list-filters.component';
import { GeneralDialogBoxComponent } from '../../dialog-box/general-dialog/general-dialog-box';

// The PC images a location can choose from (administrators): who built each, for which kind of PC, and when.
@Component({
  selector: 'webproject-config-image-list',
  templateUrl: './config-image-list.component.html'
})

export class ConfigImageListComponent implements OnInit {

  @ViewChild(MatTable) table: MatTable<ConfigImages>;

  @ViewChild(MatSort) set sort(sort: MatSort) {
    this.ConfigService.imageList.sort = sort;
  }

  constructor(
    public ConfigService: ConfigService,
    public dialog: MatDialog,
    private cd: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {  }
  displayedColumns = [];

  // The hardware types an image can be made for: types in categories that use a PC image.
  pcTypes: string[] = [];
  saving = false;

  term = '';
  selection: IListFilterSelection = {};

  // The filter choices are worked out again only when the images or the types change.
  private groupsFor: any[] | null = null;
  private groupsTypes: string[] | null = null;
  private cachedGroups: IListFilterGroup[] = [];

  columnNames = [
    { id: 'name', value: 'Image', type: 'string', editable: true, required: true },
    { id: 'description', value: 'Description', type: 'string', editable: true, required: true },
    { id: 'added_by', value: 'Added by', type: 'string', editable: true, required: true },
    { id: 'responsible_person', value: 'Responsible person', type: 'string', editable: true, required: true },
    { id: 'pc_type', value: 'PC type', type: 'string', editable: true, required: true },
    { id: 'date_created', value: 'Date created', type: 'string', editable: true, required: true },
    { id: 'isEdit', value: '', type: 'isEdit', required: false },
  ];

  ngOnInit() {
    this.ConfigService.checkIfAdmin();
    this.displayedColumns = this.columnNames.map((x) => x.id);
    // A row being added or edited always stays in view, whatever is filtered.
    this.ConfigService.imageList.filterPredicate = (image: any) => image.isEdit || (matchesFilters(image, this.selection) && matchesTerm(this.searchText(image), this.term));
    this.refilter();
    this.ConfigService.getImageTypes().subscribe(types => this.pcTypes = types);
    this.load();
  }

  load() {
    this.ConfigService.getImageList();
  }

  detectChanges() {
    this.cd.detectChanges();
  }

  saveChanges(element: any) {

    const missingFields = this.columnNames
      .filter(col => col.required)
      .filter(col => {
        const value =
          col.id === 'date_created'
            ? element.date_created_edit
            : element[col.id];

        return !value?.toString().trim();
      });

    if (missingFields.length > 0) {
      this.dialog.open(GeneralDialogBoxComponent,{
        data: {
          title: "Empty Fields",
          message: 'Please fill in all required fields.\n\n' + missingFields.map(x => ` • ${x.value}`).join('\n')
        }
      });
      return;
    }

    // Update the element date with the edited date
    element.date_created = element.date_created_edit;

    this.saving = true;
    this.ConfigService.updateImageList(element).subscribe(
      () => {
        this.saving = false;
        element.isEdit = false;
        this.ConfigService.getImageList();
        this.detectChanges();
      },
      (error) => this.saveFailed(error)
    );
  }

  // The server says why it refused (a name already used, a type that has no images...); the row stays open to fix.
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
      this.ConfigService.imageList.data = this.ConfigService.imageList.data.filter(row => row !== element);
      this.table.renderRows();
    }
    else {
      element.isEdit = false;
      this.ConfigService.getImageList();
      this.table.renderRows();
    }
  }

  addImage() {
      const newImage = <ConfigImages>{
        name: '',
        description: '',
        added_by: '',
        responsible_person: '',
        pc_type: '',
        date_created: '',
        date_created_edit: '',
        isEdit: true
      };
      this.ConfigService.imageList.data = [newImage, ...this.ConfigService.imageList.data];
      this.table.renderRows();
  }

  private searchText(image: any): string {
    return ['name', 'description', 'added_by', 'responsible_person', 'pc_type'].map(key => image[key]).join(' ');
  }

  private refilter() {
    // The table only re-runs its filter when this value changes.
    this.ConfigService.imageList.filter = JSON.stringify([this.term, this.selection]);
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
    const images = this.ConfigService.imageList.data;
    if (this.groupsFor !== images || this.groupsTypes !== this.pcTypes) {
      this.groupsFor = images;
      this.groupsTypes = this.pcTypes;
      this.cachedGroups = [
        { key: 'pc_type', title: 'PC type', options: filterOptions(this.pcTypes) },
        { key: 'added_by', title: 'Added by', options: rowFilterOptions(images, 'added_by') },
        { key: 'responsible_person', title: 'Responsible', options: rowFilterOptions(images, 'responsible_person') },
      ];
    }
    return this.cachedGroups;
  }

  editRow(element: any) {
    element.date_created_edit = this.formatDateForInput(element.date_created);
    element.isEdit = true;
  }

  formatDateForInput(dateValue: any): string {

    if (!dateValue) {
      return '';
    }

    // DD/MM/YYYY
    const match = String(dateValue).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }

    // ISO string
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      return dateValue.substring(0, 10);
    }

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    return '';
  }

}
