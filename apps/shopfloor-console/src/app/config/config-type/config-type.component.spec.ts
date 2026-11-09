import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ConfigTypeComponent } from './config-type.component';

describe('ConfigTypeComponent', () => {
  let service: any;
  let component: ConfigTypeComponent;

  beforeEach(() => {
    service = {
      locationCategoryTypes: [] as string[],
      checkIfAdmin: jest.fn(),
      getLocationCategoryTypes: jest.fn(),
      getCatalogue: jest.fn(() => of({ categories: [] })),
      category: (name: string) => (name === 'PC' ? { name: 'PC', icon: 'desktop' } : undefined),
    };
    const route: any = { paramMap: of(convertToParamMap({ location: 'Meridian HQ', category: 'PC' })) };
    component = new ConfigTypeComponent(service, route);
  });

  it('loads the types of the category in the address', () => {
    component.ngOnInit();
    expect([component.location, component.category]).toEqual(['Meridian HQ', 'PC']);
    expect(service.getLocationCategoryTypes).toHaveBeenCalledWith('Meridian HQ', 'PC');
  });

  it('shows a tile per type and narrows them with the search', () => {
    component.ngOnInit();
    service.locationCategoryTypes = ['Kiosk A PC', 'Unit X1 PC', 'Bio PC'];
    expect(component.tiles).toEqual(['Kiosk A PC', 'Unit X1 PC', 'Bio PC']);
    component.setTerm('x1 pc');
    expect(component.tiles).toEqual(['Unit X1 PC']);
    component.setTerm('nothing like this');
    expect(component.tiles).toEqual([]);
  });

  it('shows types the service adds to its list in place', () => {
    component.ngOnInit();
    expect(component.tiles).toEqual([]);
    service.locationCategoryTypes.push('Bio PC');
    expect(component.tiles).toEqual(['Bio PC']);
  });

  it('uses the icon of its category', () => {
    component.ngOnInit();
    expect(component.icon()).toBe('desktop');
  });
});
