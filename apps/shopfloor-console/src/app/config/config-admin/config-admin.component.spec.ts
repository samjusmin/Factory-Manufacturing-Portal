import { MatTableDataSource } from '@angular/material/table';
import { IConfigLocation } from '@webproject/data';
import { ConfigAdminComponent } from './config-admin.component';

const locations: IConfigLocation[] = [
  { location: 'Meridian HQ', item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Unit X1 PC'] }] },
  { location: 'Northwind Partners', item_access: [] },
];

describe('ConfigAdminComponent', () => {
  let service: any;
  let component: ConfigAdminComponent;

  beforeEach(() => {
    service = {
      locationDatasource: new MatTableDataSource<IConfigLocation>(locations),
      checkIfAdmin: jest.fn(),
      getAllLocations: jest.fn(),
    };
    component = new ConfigAdminComponent({} as any, service);
  });

  it('checks the user and loads the locations when it opens', () => {
    component.ngOnInit();
    expect(service.checkIfAdmin).toHaveBeenCalled();
    expect(service.getAllLocations).toHaveBeenCalledTimes(1);
  });

  it('shows a tile for each location with what it can configure', () => {
    expect(component.tiles).toEqual([
      { name: 'Meridian HQ', meta: '1 category · 2 hardware types' },
      { name: 'Northwind Partners', meta: 'Nothing set up yet' },
    ]);
  });

  it('keeps the same tiles until the locations or the search change', () => {
    const first = component.tiles;
    expect(component.tiles).toBe(first);
    component.setTerm('north');
    expect(component.tiles.map(t => t.name)).toEqual(['Northwind Partners']);
    component.setTerm('');
    expect(component.tiles.length).toBe(2);
  });

  it('picks up locations that arrive later', () => {
    service.locationDatasource.data = [];
    expect(component.tiles).toEqual([]);
    service.locationDatasource.data = locations;
    expect(component.tiles.length).toBe(2);
  });
});
