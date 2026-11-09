import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { IConfigLocation } from '@webproject/data';
import { ConfigCategoriesComponent } from './config-categories.component';

const meridian: IConfigLocation = {
  location: 'Meridian HQ',
  item_access: [
    { hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Unit X1 PC'] },
    { hardware_category: 'Network Switch', hardware_type: ['5-port D-Link'] },
  ],
};

describe('ConfigCategoriesComponent', () => {
  let service: any;
  let component: ConfigCategoriesComponent;

  beforeEach(() => {
    service = {
      locationCategories: [] as string[],
      locationDatasource: new MatTableDataSource<IConfigLocation>([meridian]),
      checkIfAdmin: jest.fn(),
      getLocationCategories: jest.fn(),
      getCatalogue: jest.fn(() => of({ categories: [] })),
      catalogue: { categories: [] },
      category: (name: string) => ({ PC: { name: 'PC', icon: 'desktop' }, 'Network Switch': { name: 'Network Switch', icon: 'cogs' } } as any)[name],
    };
    const route: any = { paramMap: of(convertToParamMap({ location: 'Meridian HQ' })) };
    component = new ConfigCategoriesComponent(service, route);
  });

  it('loads the categories of the location in the address', () => {
    component.ngOnInit();
    expect(component.location).toBe('Meridian HQ');
    expect(service.getLocationCategories).toHaveBeenCalledWith('Meridian HQ');
  });

  it('shows a tile for each category with an icon and a count', () => {
    component.ngOnInit();
    service.locationCategories = ['PC', 'Network Switch'];
    expect(component.tiles).toEqual([
      { name: 'PC', icon: 'desktop', meta: '2 hardware types' },
      { name: 'Network Switch', icon: 'cogs', meta: '1 hardware type' },
    ]);
  });

  it('shows categories the service adds to its list in place', () => {
    component.ngOnInit();
    expect(component.tiles).toEqual([]);
    service.locationCategories.push('PC');
    expect(component.tiles.map(t => t.name)).toEqual(['PC']);
  });
});
