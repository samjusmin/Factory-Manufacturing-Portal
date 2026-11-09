import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FilterOption } from '../../fat/filter-picker/filter-picker.component';

export interface IListFilterGroup {
  key: string;
  title: string;
  options: FilterOption[];
}

// The values chosen in each filter. A filter with nothing chosen does not narrow the list.
export interface IListFilterSelection {
  [key: string]: string[];
}

interface IActiveTag {
  key: string;
  group: string;
  value: string;
  label: string;
}

// The toolbar of a list that is filtered in the browser, working like Deep Search: the page's search box and actions
// are projected in beside a Filters button, which opens a row of filter dropdowns and remembers whether it was left
// open. What is switched on shows as removable tags. The parent owns the selection and does the filtering.
@Component({
  selector: 'webproject-list-filters',
  templateUrl: './list-filters.component.html'
})
export class ListFiltersComponent implements OnInit, OnChanges {
  // Where the open or closed choice is remembered; each list has its own.
  @Input() storageKey = '';
  @Input() groups: IListFilterGroup[] = [];
  @Input() selection: IListFilterSelection = {};
  @Output() selectionChange = new EventEmitter<IListFilterSelection>();

  filtersOpen = false;
  tags: IActiveTag[] = [];

  ngOnInit(): void {
    try {
      this.filtersOpen = localStorage.getItem(this.storageKey) === '1';
    } catch (e) {
      this.filtersOpen = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.groups || changes.selection) {
      this.tags = this.groups.reduce((all, group) => all.concat((this.selection[group.key] || []).map(value => {
        const option = group.options.find(o => o.value === value);
        return { key: group.key, group: group.title, value, label: option ? option.label : value };
      })), [] as IActiveTag[]);
    }
  }

  toggle(): void {
    this.filtersOpen = !this.filtersOpen;
    try {
      localStorage.setItem(this.storageKey, this.filtersOpen ? '1' : '0');
    } catch (e) {
      // The choice just is not remembered.
    }
  }

  choose(key: string, values: string[]): void {
    this.selectionChange.emit({ ...this.selection, [key]: values });
  }

  remove(tag: IActiveTag): void {
    this.choose(tag.key, (this.selection[tag.key] || []).filter(v => v !== tag.value));
  }

  clear(): void {
    this.selectionChange.emit({});
  }

  trackTag(index: number, tag: IActiveTag): string {
    return tag.key + '|' + tag.value;
  }

  trackGroup(index: number, group: IListFilterGroup): string {
    return group.key;
  }
}
