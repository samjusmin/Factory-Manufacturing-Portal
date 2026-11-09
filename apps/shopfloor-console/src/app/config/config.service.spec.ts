import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfigService } from './config.service';

const locations = [
  {
    location: 'Meridian HQ',
    item_access: [
      { hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Kiosk A PC', 'Unit X1 PC'] },
      { hardware_category: 'PC', hardware_type: ['Bio PC'] },
      { hardware_category: 'Network Switch', hardware_type: ['5-port D-Link'] },
    ],
    projects: ['PRJ-ALPHA'],
  },
];

const catalogue = {
  categories: [
    { name: 'PC', icon: 'desktop', uses_image: true, parts: [], types: ['Kiosk A PC'] },
    { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1'], types: ['UNIT-W1 Set'] },
  ],
};

describe('ConfigService', () => {
  let service: ConfigService;
  let http: HttpTestingController;

  const signIn = (role: string) => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem('role', role);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule] });
    service = TestBed.inject(ConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('knows an administrator from their sign-in without asking the server', async () => {
    signIn('ADMIN');
    expect(await service.checkIfAdmin()).toBe(true);
    expect([service.isAdmin, service.showError]).toEqual([true, false]);

    signIn('OPERATOR');
    expect(await service.checkIfAdmin()).toBe(false);
    expect([service.isAdmin, service.showError]).toEqual([false, true]);
    http.expectNone('/api/fat-project/adminCheck');
  });

  describe('the hardware catalogue', () => {
    it('is remembered once it has loaded, so pages can look a category up', () => {
      signIn('ADMIN');
      expect(service.category('PC')).toBeUndefined();
      service.getCatalogue().subscribe();
      const req = http.expectOne('/api/config-catalogue');
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
      req.flush(catalogue);
      expect(service.catalogueLoaded).toBe(true);
      expect(service.category('UNIT-W1').parts).toEqual(['Unit W1-1']);
      expect(service.category('Toaster')).toBeUndefined();
    });

    it('asks for the types an image can be made for and for one type\'s checklist', () => {
      signIn('ADMIN');
      let types: string[];
      service.getImageTypes().subscribe(t => types = t);
      http.expectOne('/api/config-catalogue/image-types').flush(['Kiosk A PC']);
      expect(types).toEqual(['Kiosk A PC']);
      service.getCatalogueType('5-port D-Link').subscribe();
      http.expectOne('/api/config-catalogue/types/5-port%20D-Link').flush({ category: 'Network Switch', name: '5-port D-Link', checklist: [] });
    });

    it('adds, changes and deletes categories and types, keeping the catalogue it gets back', () => {
      signIn('ADMIN');
      service.createCategory({ name: 'Racks' }).subscribe();
      let req = http.expectOne('/api/config-catalogue/categories');
      expect([req.request.method, req.request.body]).toEqual(['POST', { name: 'Racks' }]);
      req.flush(catalogue);
      expect(service.catalogue).toBe(catalogue);

      service.updateCategory('UNIT-W1', { icon: 'tools' }).subscribe();
      req = http.expectOne('/api/config-catalogue/categories/UNIT-W1');
      expect(req.request.method).toBe('PATCH');
      req.flush(catalogue);

      service.deleteCategory('Racks').subscribe();
      req = http.expectOne('/api/config-catalogue/categories/Racks');
      expect(req.request.method).toBe('DELETE');
      req.flush(catalogue);

      service.createType({ category: 'PC', name: 'Bio PC' }).subscribe();
      http.expectOne('/api/config-catalogue/types').flush(catalogue);
      service.deleteType('Bio PC').subscribe();
      req = http.expectOne('/api/config-catalogue/types/Bio%20PC');
      expect(req.request.method).toBe('DELETE');
      req.flush(catalogue);
    });

    it('saves a type\'s checklist', () => {
      signIn('ADMIN');
      service.saveChecklist('Bio PC', [{ description: 'a' }]).subscribe();
      const req = http.expectOne('/api/config-catalogue/types/Bio%20PC/checklist');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ checklist: [{ description: 'a' }] });
      req.flush({ name: 'Bio PC', rows: 1 });
    });
  });

  describe('locations', () => {
    it('lists a location\'s categories once each and says when they have arrived', () => {
      signIn('ADMIN');
      service.getLocationCategories('Meridian HQ');
      expect(service.locationsLoaded).toBe(false);
      http.expectOne('/api/config-location/').flush(locations);
      expect(service.locationCategories).toEqual(['PC', 'Network Switch']);
      expect(service.locationsLoaded).toBe(true);
      expect(service.loadError).toBe(false);
    });

    it('only asks for its own location when the user is not an administrator', () => {
      signIn('OPERATOR');
      service.getLocationCategories('Meridian HQ');
      http.expectOne('/api/config-location/mine').flush(locations);
      expect(service.locationCategories).toEqual(['PC', 'Network Switch']);
    });

    it('lists the types of one category once each', () => {
      signIn('ADMIN');
      service.getLocationCategoryTypes('Meridian HQ', 'PC');
      http.expectOne('/api/config-location/').flush(locations);
      expect(service.locationCategoryTypes).toEqual(['Kiosk A PC', 'Unit X1 PC']);
    });

    it('fills the locations table in place so its sorting stays attached', () => {
      signIn('ADMIN');
      const source = service.locationDatasource;
      service.getAllLocations();
      http.expectOne('/api/config-location/').flush(locations);
      expect(service.locationDatasource).toBe(source);
      expect(source.data).toEqual(locations);
    });

    it('finds one location with its projects', () => {
      signIn('ADMIN');
      let found: any;
      service.getLocation('Meridian HQ').subscribe(l => found = l);
      http.expectOne('/api/config-location/').flush(locations);
      expect(found.projects).toEqual(['PRJ-ALPHA']);
      let missing: any = 'unset';
      service.getLocation('Nowhere').subscribe(l => missing = l);
      http.expectOne('/api/config-location/').flush(locations);
      expect(missing).toBeUndefined();
    });

    it('adds a location by name and saves its access and projects', () => {
      signIn('ADMIN');
      service.addNewLocation('Partner D').subscribe();
      let req = http.expectOne('/api/config-location/');
      expect([req.request.method, req.request.body]).toEqual(['POST', { type: 'ENTRY', data: { location: 'Partner D' } }]);
      req.flush({});

      service.updateLocItemAccess({ location: 'Partner D', item_access: [], projects: ['PRJ-X'] } as any).subscribe();
      req = http.expectOne('/api/config-location/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.data.projects).toEqual(['PRJ-X']);
      req.flush({});
    });

    it('asks which models and images a location may use, with the names encoded', () => {
      signIn('ADMIN');
      service.getAccessibleHardware('Meridian HQ', 'Network Switch').subscribe();
      http.expectOne('/api/config-location/Meridian%20HQ/hardware/Network%20Switch').flush([]);
      service.getAccessibleImages('Meridian HQ', 'Kiosk A PC').subscribe();
      http.expectOne('/api/config-location/Meridian%20HQ/Kiosk%20A%20PC').flush([]);
    });
  });

  describe('units', () => {
    it('fills the unit list in place, clearing the last list while the next loads', () => {
      signIn('ADMIN');
      const source = service.hardwareUnitsDatasource;
      service.getHardwareUnits('Meridian HQ', 'PC', 'Kiosk A PC');
      expect(service.unitsLoaded).toBe(false);
      http.expectOne('/api/config-hardware/Meridian%20HQ/PC/Kiosk%20A%20PC').flush([{ serial_no: 'S1' }]);
      expect(service.hardwareUnitsDatasource).toBe(source);
      expect(source.data).toEqual([{ serial_no: 'S1' }]);
      expect(service.unitsLoaded).toBe(true);

      service.getHardwareUnits('Meridian HQ', 'PC', 'Unit X1 PC');
      expect(source.data).toEqual([]);
      http.expectOne('/api/config-hardware/Meridian%20HQ/PC/Unit%20X1%20PC').flush([]);
    });

    it('opens, adds and saves a unit', () => {
      signIn('ADMIN');
      service.getUnit('abc').subscribe();
      http.expectOne('/api/config-hardware/abc').flush({});

      service.createUnit({ serial_no: 'S1' }).subscribe();
      let req = http.expectOne('/api/config-hardware');
      expect([req.request.method, req.request.body]).toEqual(['POST', { serial_no: 'S1' }]);
      req.flush({});

      service.updateUnit({ id: 'abc', version: 2 }).subscribe();
      req = http.expectOne('/api/config-hardware');
      expect([req.request.method, req.request.body]).toEqual(['PATCH', { id: 'abc', version: 2 }]);
      req.flush({});
    });
  });

  describe('images and hardware', () => {
    it('fills the image and hardware lists in place', () => {
      signIn('ADMIN');
      const images = service.imageList;
      const hardware = service.hardwareList;
      service.getImageList();
      service.getHardwareList();
      http.expectOne('/api/pc-image/').flush([{ name: 'Image' }]);
      http.expectOne('/api/hardware-type').flush([{ name: 'Dell 7000' }]);
      expect(service.imageList).toBe(images);
      expect(service.hardwareList).toBe(hardware);
      expect(images.data.length).toBe(1);
      expect(hardware.data.length).toBe(1);
      expect(service.imagesLoaded && service.hardwareLoaded).toBe(true);
    });

    it('saves an image and a hardware model, waiting for the server', () => {
      signIn('ADMIN');
      service.updateImageList({ _id: '1', name: 'N', description: 'D', date_created_edit: '2026-10-01', added_by: 'a', responsible_person: 'r', pc_type: 'Kiosk A PC' }).subscribe();
      let req = http.expectOne('/api/pc-image/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ id: '1', name: 'N', description: 'D', date_created: '2026-10-01', added_by: 'a', responsible_person: 'r', pc_type: 'Kiosk A PC' });
      req.flush({});

      service.updateHardwareUnits({ name: 'Dell', config_type: ['PC'] } as any).subscribe();
      req = http.expectOne('/api/hardware-type/');
      expect(req.request.method).toBe('PATCH');
      req.flush({});
    });
  });
});
