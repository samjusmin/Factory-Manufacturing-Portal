import { Directive, DoCheck, Self } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';

// Data sources whose sorting has already been made case-insensitive.
const caseInsensitive = new WeakSet<MatTableDataSource<any>>();

/**
 * Connects a table's `matSort` to its MatTableDataSource.
 *
 * Without this, each page has to hand its own MatSort to every data source it creates, and the data sources
 * are replaced whenever a list is reloaded. Pages that kept the sort in a service never received it (a
 * `@ViewChild` does not resolve in a service), so clicking a header did nothing.
 */
@Directive({
  selector: 'table[mat-table][matSort], mat-table[matSort]'
})
export class TableSortDirective implements DoCheck {

  constructor(
    @Self() private table: MatTable<any>,
    @Self() private sort: MatSort
  ) {}

  ngDoCheck(): void {
    const dataSource = this.table.dataSource;
    if (!(dataSource instanceof MatTableDataSource)) {
      return;
    }

    if (!caseInsensitive.has(dataSource)) {
      // Material compares text with < and >, which puts every capital letter before every lowercase one
      // ("DGS-1005" before "Dell 7000"). Compare text without regard to case instead.
      const accessor = dataSource.sortingDataAccessor;
      dataSource.sortingDataAccessor = (data, sortHeaderId) => {
        const value = accessor(data, sortHeaderId);
        return typeof value === 'string' ? value.toLowerCase() : value;
      };
      caseInsensitive.add(dataSource);
    }

    if (dataSource.sort !== this.sort) {
      dataSource.sort = this.sort;
    }
  }
}
