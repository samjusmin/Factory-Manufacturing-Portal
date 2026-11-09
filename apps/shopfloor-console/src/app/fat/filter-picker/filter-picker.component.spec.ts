import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { FilterOption, FilterPickerComponent } from './filter-picker.component';

const options: FilterOption[] = [
  { value: 'p1', label: 'Phase 1 - Unit Z build', hint: 'PRJ-ALPHA' },
  { value: 'p2', label: 'Phase 2 - Unit X1 build', hint: 'PRJ-ALPHA' },
  { value: 'p3', label: 'Pilot units', hint: 'PRJ-CHARLIE' },
  { value: 'p4', label: 'Spares (planned)', hint: 'PRJ-ALPHA' },
];

describe('FilterPickerComponent', () => {
  let fixture: ComponentFixture<FilterPickerComponent>;
  let picker: FilterPickerComponent;
  let emitted: string[][];

  // Hands the picker its inputs the way Angular does, including the change notice.
  const give = (opts: FilterOption[], selected: string[] = []) => {
    const changes: any = {};
    if (picker.options !== opts) { changes.options = new SimpleChange(picker.options, opts, false); }
    changes.selected = new SimpleChange(picker.selected, selected, false);
    picker.options = opts;
    picker.selected = selected;
    picker.ngOnChanges(changes);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [FilterPickerComponent], schemas: [NO_ERRORS_SCHEMA] }).compileComponents();
    fixture = TestBed.createComponent(FilterPickerComponent);
    picker = fixture.componentInstance;
    picker.label = 'Phase';
    emitted = [];
    picker.selectedChange.subscribe(v => emitted.push(v));
    give(options);
  });

  it('shows "All" when nothing is chosen, the name when one is, and a count when several are', () => {
    expect(picker.summary).toBe('All');
    give(options, ['p3']);
    expect(picker.summary).toBe('Pilot units');
    give(options, ['p1', 'p3']);
    expect(picker.summary).toBe('2 selected');
    // A choice the list no longer offers still shows by its value.
    give(options, ['gone']);
    expect(picker.summary).toBe('gone');
  });

  it('narrows the choices as the user searches the label, the hint or the value, ignoring case', () => {
    picker.onTerm('PILOT');
    expect(picker.shown.map(o => o.value)).toEqual(['p3']);
    picker.onTerm('prj-alpha');
    expect(picker.shown.map(o => o.value)).toEqual(['p1', 'p2', 'p4']);
    picker.onTerm('p2');
    expect(picker.shown.map(o => o.value)).toEqual(['p2']);
    picker.onTerm('  ');
    expect(picker.shown.length).toBe(4);
    picker.onTerm('zzz');
    expect(picker.shown).toEqual([]);
  });

  it('adds and removes choices, keeping the order of the list', () => {
    picker.toggle('p3');
    picker.toggle('p1');
    expect(emitted[1]).toEqual(['p1', 'p3']);
    picker.toggle('p3');
    expect(emitted[2]).toEqual(['p1']);
    expect(picker.isChosen('p1')).toBe(true);
    expect(picker.isChosen('p3')).toBe(false);
  });

  it('keeps choices that the search is hiding, and does not lose them when another is picked', () => {
    give(options, ['p1']);
    picker.onTerm('pilot');
    expect(picker.shown.map(o => o.value)).toEqual(['p3']);
    picker.toggle('p3');
    expect(emitted[0]).toEqual(['p1', 'p3']);
  });

  it('can select everything the search shows, or clear all choices', () => {
    picker.onTerm('prj-alpha');
    picker.selectShown();
    expect(emitted[0]).toEqual(['p1', 'p2', 'p4']);
    expect(picker.shownSelectedCount).toBe(3);
    picker.clear();
    expect(emitted[1]).toEqual([]);
    expect(picker.isChosen('p1')).toBe(false);
  });

  it('picks the first match when Enter is pressed in the search box', () => {
    picker.onTerm('spares');
    const event = { preventDefault: jest.fn() } as any;
    picker.onEnter(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(emitted[0]).toEqual(['p4']);
    // Nothing matches: nothing happens.
    picker.onTerm('zzz');
    picker.onEnter(event);
    expect(emitted.length).toBe(1);
  });

  it('opens with an empty search, closes on Escape, and closes when something else is clicked', fakeAsync(() => {
    picker.onTerm('pilot');
    picker.openPanel();
    tick();
    expect(picker.open).toBe(true);
    expect(picker.term).toBe('');
    expect(picker.shown.length).toBe(4);

    picker.onEscape();
    expect(picker.open).toBe(false);

    picker.openPanel();
    tick();
    picker.onDocumentClick({ target: document.body } as any);
    expect(picker.open).toBe(false);

    // A click inside the picker leaves it open.
    picker.openPanel();
    tick();
    picker.onDocumentClick({ target: fixture.nativeElement } as any);
    expect(picker.open).toBe(true);
  }));

  it('sizes the list to its rows, up to a limit', () => {
    expect(picker.listHeight).toBe(4 * picker.rowHeight);
    const many = Array.from({ length: 5000 }, (_, i) => ({ value: 'v' + i, label: 'Value ' + i }));
    give(many);
    expect(picker.listHeight).toBe(6 * picker.rowHeight);
    // "Value 49", "Value 490"-"Value 499" and "Value 4900"-"Value 4999"
    picker.onTerm('value 49');
    expect(picker.shown.length).toBe(111);
  });

  it('keeps the same list of shown options until the options or the search change', () => {
    const before = picker.shown;
    picker.isChosen('p1');
    expect(picker.shown).toBe(before);
    give(options, ['p2']);
    expect(picker.shown).toBe(before);
  });
});
