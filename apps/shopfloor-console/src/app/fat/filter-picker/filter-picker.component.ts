import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

export interface FilterOption {
  value: string;
  label: string;
  // A smaller second line of text beside the label, such as the project a phase belongs to.
  hint?: string;
}

const ROW_HEIGHT = 40;
const MAX_ROWS = 6;

// A multi-select dropdown for a long list of choices: it has its own search box to narrow the list, and only draws
// the rows that are on screen, so thousands of options stay quick. Choices made are kept even while the search hides
// them, so narrowing the list never loses a selection.
//
// The lists it is given are worked out once, not on every screen update: the parent must pass the same array until
// the options really change.
@Component({
  selector: 'webproject-filter-picker',
  templateUrl: './filter-picker.component.html',
  styleUrls: ['./filter-picker.component.css']
})
export class FilterPickerComponent implements OnChanges {
  @Input() label = '';
  @Input() options: FilterOption[] = [];
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  readonly rowHeight = ROW_HEIGHT;

  open = false;
  term = '';
  // The options that match the search (all of them when it is empty).
  shown: FilterOption[] = [];
  private chosen = new Set<string>();

  @ViewChild('search') searchInput: ElementRef<HTMLInputElement>;
  @ViewChild('trigger') trigger: ElementRef<HTMLButtonElement>;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.options) {
      this.refilter();
    }
    if (changes.selected) {
      this.chosen = new Set(this.selected || []);
    }
  }

  // ---------- what is shown ----------

  // What the button says: nothing chosen means no filtering, so "All".
  get summary(): string {
    const values = this.selected || [];
    if (!values.length) {
      return 'All';
    }
    if (values.length === 1) {
      const option = this.options.find(o => o.value === values[0]);
      return option ? option.label : values[0];
    }
    return values.length + ' selected';
  }

  // The height of the list: as tall as the rows, up to a limit, after which it scrolls.
  get listHeight(): number {
    return Math.min(this.shown.length, MAX_ROWS) * ROW_HEIGHT;
  }

  get shownSelectedCount(): number {
    return this.shown.filter(o => this.chosen.has(o.value)).length;
  }

  isChosen(value: string): boolean {
    return this.chosen.has(value);
  }

  trackOption(index: number, option: FilterOption) {
    return option.value;
  }

  // ---------- searching ----------

  onTerm(term: string) {
    this.term = term;
    this.refilter();
  }

  private refilter() {
    const term = this.term.trim().toLowerCase();
    const options = this.options || [];
    this.shown = !term ? options : options.filter(o =>
      [o.label, o.hint, o.value].some(text => (text || '').toLowerCase().indexOf(term) !== -1));
  }

  // ---------- choosing ----------

  toggle(value: string) {
    if (this.chosen.has(value)) {
      this.chosen.delete(value);
    } else {
      this.chosen.add(value);
    }
    this.emit();
  }

  // Adds everything the search currently shows to the choices.
  selectShown() {
    this.shown.forEach(o => this.chosen.add(o.value));
    this.emit();
  }

  clear() {
    this.chosen.clear();
    this.emit();
  }

  // Enter in the search box picks (or unpicks) the first match, so a typed name can be chosen without the mouse.
  onEnter(event: Event) {
    event.preventDefault();
    if (this.shown.length) {
      this.toggle(this.shown[0].value);
    }
  }

  private emit() {
    // Keep the order of the options, so the same choices always come out the same way.
    const order = new Map((this.options || []).map((o, i) => [o.value, i] as [string, number]));
    const values = Array.from(this.chosen).sort((a, b) => (order.has(a) ? order.get(a) : 1e9) - (order.has(b) ? order.get(b) : 1e9));
    this.selected = values;
    this.selectedChange.emit(values);
  }

  // ---------- opening and closing ----------

  toggleOpen() {
    this.open ? this.close(false) : this.openPanel();
  }

  openPanel() {
    this.open = true;
    this.term = '';
    this.refilter();
    // Put the cursor in the search box once the panel exists.
    setTimeout(() => this.searchInput && this.searchInput.nativeElement.focus());
  }

  close(returnFocus = true) {
    this.open = false;
    if (returnFocus && this.trigger) {
      this.trigger.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  // Listens on the whole page, not just the picker: after a click focus can be anywhere, and Escape should still close it.
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open) {
      this.close();
    }
  }
}
