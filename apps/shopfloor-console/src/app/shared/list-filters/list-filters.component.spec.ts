import { SimpleChange } from '@angular/core';
import { ListFiltersComponent } from './list-filters.component';

const groups = [
  { key: 'pc_type', title: 'PC type', options: [{ value: 'Bio PC', label: 'Bio PC' }] },
  { key: 'added_by', title: 'Added by', options: [{ value: 'admin', label: 'Alex' }] },
];

function build(selection: any = {}) {
  const component = new ListFiltersComponent();
  component.storageKey = 'test-filters-open';
  component.groups = groups;
  component.selection = selection;
  component.ngOnChanges({ selection: new SimpleChange(null, selection, true) });
  component.ngOnInit();
  return component;
}

describe('ListFiltersComponent', () => {
  beforeEach(() => localStorage.clear());

  it('starts closed and remembers being opened', () => {
    const component = build();
    expect(component.filtersOpen).toBe(false);
    component.toggle();
    expect(component.filtersOpen).toBe(true);
    expect(build().filtersOpen).toBe(true);
    component.toggle();
    expect(build().filtersOpen).toBe(false);
  });

  it('shows a tag for each choice, using the option label', () => {
    expect(build({ pc_type: ['Bio PC'], added_by: ['admin'] }).tags.map((t) => [t.group, t.label])).toEqual([['PC type', 'Bio PC'], ['Added by', 'Alex']]);
    expect(build({ pc_type: ['Gone PC'] }).tags[0].label).toBe('Gone PC');
    expect(build().tags).toEqual([]);
  });

  it('reports a new choice, keeping the other filters', () => {
    const component = build({ added_by: ['admin'] });
    const sent = [];
    component.selectionChange.subscribe((s) => sent.push(s));
    component.choose('pc_type', ['Bio PC']);
    expect(sent[0]).toEqual({ added_by: ['admin'], pc_type: ['Bio PC'] });
  });

  it('removes one tag or clears them all', () => {
    const component = build({ pc_type: ['Bio PC', 'Kiosk'] });
    const sent = [];
    component.selectionChange.subscribe((s) => sent.push(s));
    component.remove(component.tags[0]);
    expect(sent[0]).toEqual({ pc_type: ['Kiosk'] });
    component.clear();
    expect(sent[1]).toEqual({});
  });
});
