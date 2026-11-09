import { of, throwError } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { IConfigLocation } from '@webproject/data';
import { ConfigLocationsComponent } from './config-locations.component';

describe('ConfigLocationsComponent', () => {
  let service: any;
  let dialog: any;
  let snackBar: any;
  let component: ConfigLocationsComponent;

  beforeEach(() => {
    service = {
      locationDatasource: new MatTableDataSource<IConfigLocation>([
        { location: 'Meridian HQ', item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }], image_access: ['a', 'b'], hardware_access: ['c'] },
        { location: 'Partner A', item_access: [] },
      ]),
      checkIfAdmin: jest.fn(),
      getAllLocations: jest.fn(),
      addNewLocation: jest.fn(() => of({})),
    };
    dialog = { open: jest.fn() };
    snackBar = { open: jest.fn() };
    component = new ConfigLocationsComponent(dialog, service, snackBar);
    (component as any).table = { renderRows: jest.fn() };
  });

  it('loads the locations and shows a column for each thing a location can access', () => {
    component.ngOnInit();
    expect(service.getAllLocations).toHaveBeenCalled();
    expect(component.displayedColumns).toEqual(['location', 'access', 'images', 'hardware', 'isEdit']);
  });

  it('sorts by name and by how much each location can access', () => {
    const [meridian, partner] = service.locationDatasource.data;
    const access = service.locationDatasource.sortingDataAccessor;
    expect(access(meridian, 'location')).toBe('meridian hq');
    expect(access(meridian, 'images')).toBe(2);
    expect(access(meridian, 'hardware')).toBe(1);
    expect(access(partner, 'images')).toBe(0);
    expect(access(partner, 'access')).toBe(0);
  });

  it('adds an empty row to name a new location', () => {
    component.addLocation();
    expect(service.locationDatasource.data[0]).toEqual({ location: '', item_access: [], isEdit: true });
    expect(service.locationDatasource.data.length).toBe(3);
  });

  it('will not save a location without a name', () => {
    const row: any = { location: '   ', item_access: [], isEdit: true };
    component.confirmEntry(row);
    expect(dialog.open).toHaveBeenCalled();
    expect(service.addNewLocation).not.toHaveBeenCalled();
    expect(row.isEdit).toBe(true);
  });

  it('saves a named location, trimmed', () => {
    const row: any = { location: ' Partner D ', item_access: [], isEdit: true };
    component.confirmEntry(row);
    expect(service.addNewLocation).toHaveBeenCalledWith('Partner D');
    expect(row.location).toBe('Partner D');
    expect(row.isEdit).toBe(false);
    expect(service.getAllLocations).toHaveBeenCalled();
  });

  it('keeps the new row open and says why when the server refuses the name', () => {
    service.addNewLocation.mockReturnValueOnce(throwError({ status: 409, error: { message: 'There is already a location called "Partner D".' } }));
    const row: any = { location: 'Partner D', item_access: [], isEdit: true };
    component.confirmEntry(row);
    expect(row.isEdit).toBe(true);
    expect(snackBar.open).toHaveBeenCalledWith('There is already a location called "Partner D".', 'OK', expect.anything());
  });

  it('takes a discarded row off the screen, even with a filter on', () => {
    service.locationDatasource.filterPredicate = () => true;
    service.locationDatasource.filter = 'anything';
    const before = service.locationDatasource.filteredData.length;
    component.addLocation();
    const added = service.locationDatasource.data[0];
    expect(service.locationDatasource.filteredData.length).toBe(before + 1);
    component.cancelEntry(added);
    expect(service.locationDatasource.filteredData.length).toBe(before);
    expect(service.locationDatasource.filteredData).not.toContain(added);
  });

  it('discards a new row', () => {
    component.addLocation();
    component.cancelEntry(service.locationDatasource.data[0]);
    expect(service.locationDatasource.data.length).toBe(2);
  });

  it('filters by name', () => {
    component.applyFilter('  PARTNER ');
    expect(service.locationDatasource.filter).toBe('partner');
    expect(service.locationDatasource.filteredData.map(l => l.location)).toEqual(['Partner A']);
  });
});
