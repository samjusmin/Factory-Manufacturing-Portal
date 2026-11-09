import { IConfigCategory, IConfigLocation } from '@webproject/data';
import {
  categorySummary,
  errorMessage,
  filterOptions,
  locationSummary,
  matchesFilters,
  matchesProgress,
  matchesTerm,
  progressState,
  projectFilters,
  rowFilterOptions,
  typesIn,
  unitColumns,
  unitSearchText,
} from './config-view';

const location: IConfigLocation = {
  location: 'Meridian HQ',
  item_access: [
    { hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Unit X1 PC'] },
    { hardware_category: 'Network Switch', hardware_type: ['5-port D-Link'] },
  ],
};

const category = (extra: Partial<IConfigCategory> = {}): IConfigCategory => ({ name: 'X', icon: 'box-open', uses_image: false, parts: [], ...extra });

describe('config view helpers', () => {
  it('lists the types a location may use in a category', () => {
    expect(typesIn(location, 'PC')).toEqual(['Kiosk A PC', 'Unit X1 PC']);
    expect(typesIn(location, 'Other')).toEqual([]);
    expect(typesIn(undefined, 'PC')).toEqual([]);
  });

  it('counts a type once when a category lists it twice', () => {
    const twice: IConfigLocation = { location: 'X', item_access: [
      { hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }, { hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Bio PC'] },
    ] };
    expect(typesIn(twice, 'PC')).toEqual(['Kiosk A PC', 'Bio PC']);
  });

  it('sums up what a location can configure', () => {
    expect(locationSummary(location)).toBe('2 categories · 3 hardware types');
    expect(locationSummary({ location: 'One', item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }] })).toBe('1 category · 1 hardware type');
    expect(locationSummary({ location: 'Empty', item_access: [] })).toBe('Nothing set up yet');
  });

  it('sums up a category', () => {
    expect(categorySummary(location, 'PC')).toBe('2 hardware types');
    expect(categorySummary(location, 'Network Switch')).toBe('1 hardware type');
  });

  it('turns progress into a status', () => {
    expect(progressState(0).label).toBe('Not started');
    expect(progressState(null).label).toBe('Not started');
    expect(progressState(40)).toEqual({ label: 'In progress', cls: 'state-in-progress' });
    expect(progressState(100)).toEqual({ label: 'Complete', cls: 'state-complete' });
  });

  it('filters by status', () => {
    expect(matchesProgress(0, 'All')).toBe(true);
    expect(matchesProgress(0, 'Not started')).toBe(true);
    expect(matchesProgress(50, 'Not started')).toBe(false);
    expect(matchesProgress(100, 'Complete')).toBe(true);
  });

  it('searches for every word typed', () => {
    expect(matchesTerm('DL7000-A1001 KA-PC-001 Dell 7000', 'dell 7000')).toBe(true);
    expect(matchesTerm('DL7000-A1001 KA-PC-001 Dell 7000', 'dell 7080')).toBe(false);
    expect(matchesTerm('anything', '   ')).toBe(true);
  });

  describe('unit columns', () => {
    const names = (c: IConfigCategory) => unitColumns(c).map(x => x.name);

    it('starts with the serial no. in every category', () => {
      expect(names(category())[0]).toBe('serial_no');
      expect(names(category())).toEqual(['serial_no', 'device_name', 'model', 'project', 'progress', 'state']);
    });

    it('adds an image column only where units have a PC image', () => {
      expect(names(category({ uses_image: true }))).toEqual(['serial_no', 'device_name', 'model', 'project', 'pc_image', 'progress', 'state']);
    });

    it('adds a parts column only where units have parts', () => {
      expect(names(category({ parts: ['Grid 2'] }))).toContain('parts');
      expect(names(category({ parts: [] }))).not.toContain('parts');
    });

    it('still has columns before the catalogue has loaded', () => {
      expect(unitColumns(undefined).map(c => c.name)).toEqual(['serial_no', 'device_name', 'model', 'project', 'progress', 'state']);
    });
  });

  it('searches what is shown in a row and the serial no. of each part', () => {
    const columns = unitColumns(category({ parts: ['Unit W1-1'] }));
    const unit = { serial_no: 'W1-SET-1', model: 'W1 Controller', project: 'STOCK', device_name: null, parts: [{ name: 'Unit W1-1', serial_no: 'MEMBER-9' }] };
    const text = unitSearchText(unit, columns);
    expect(matchesTerm(text, 'member-9')).toBe(true);
    expect(matchesTerm(text, 'w1 controller stock')).toBe(true);
    expect(matchesTerm(text, 'nonsense')).toBe(false);
  });

  it('offers a filter for STOCK and each project that has units', () => {
    const units = [{ project: 'PRJ-A' }, { project: 'PRJ-A' }, { project: 'STOCK' }];
    expect(projectFilters(['STOCK', 'PRJ-A', 'PRJ-B'], units)).toEqual(['All', 'STOCK', 'PRJ-A']);
    expect(projectFilters(['STOCK', 'PRJ-A'], [])).toEqual(['All', 'STOCK']);
  });

  it('shows the server\'s reason for a refused request, or a fallback', () => {
    expect(errorMessage({ status: 409, error: { message: 'Serial no. X is already used.' } }, 'Could not save.')).toBe('Serial no. X is already used.');
    expect(errorMessage({ status: 400, error: { message: ['First', 'Second'] } }, 'Could not save.')).toBe('First');
    expect(errorMessage({ status: 500, error: { message: 'Boom' } }, 'Could not save.')).toBe('Could not save.');
    expect(errorMessage(null, 'Could not save.')).toBe('Could not save.');
  });

  describe('list filters', () => {
    it('offers each different value once, in order, without blanks', () => {
      expect(filterOptions(['Sam', 'Alex', 'Sam', '', null, ' '])).toEqual([{ value: 'Alex', label: 'Alex' }, { value: 'Sam', label: 'Sam' }]);
    });

    it('reads the choices from a column holding one value or several', () => {
      expect(rowFilterOptions([{ a: 'x' }, { a: 'y' }, { a: '' }], 'a').map(o => o.value)).toEqual(['x', 'y']);
      expect(rowFilterOptions([{ a: ['x', 'y'] }, { a: ['y'] }, { a: [] }], 'a').map(o => o.value)).toEqual(['x', 'y']);
    });

    it('passes a row that meets every filter with something chosen', () => {
      const row = { pc_type: 'Bio PC', added_by: 'Alex', config_type: ['PC'] };
      expect(matchesFilters(row, {})).toBe(true);
      expect(matchesFilters(row, { pc_type: [] })).toBe(true);
      expect(matchesFilters(row, { pc_type: ['Bio PC', 'Kiosk'] })).toBe(true);
      expect(matchesFilters(row, { pc_type: ['Kiosk'] })).toBe(false);
      expect(matchesFilters(row, { pc_type: ['Bio PC'], added_by: ['Sam'] })).toBe(false);
      expect(matchesFilters(row, { config_type: ['PC'] })).toBe(true);
      expect(matchesFilters(row, { config_type: ['Printer'] })).toBe(false);
    });
  });
});
