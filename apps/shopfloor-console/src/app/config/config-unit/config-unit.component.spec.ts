import { convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { IConfigCategory } from '@webproject/data';
import { ConfigUnitComponent } from './config-unit.component';

const units: any[] = [
  { _id: '1', serial_no: 'DL7000-A1001', device_name: 'KA-PC-001', model: 'Dell 7000', project: 'PRJ-ALPHA', pc_image: 'KioskA_v3', parts: [], progress: 100 },
  { _id: '2', serial_no: 'DL7000-A1002', device_name: 'KA-PC-002', model: 'Dell 7000', project: 'PRJ-ALPHA', pc_image: 'KioskA_v3', parts: [], progress: 60 },
  { _id: '3', serial_no: 'DL7080-A1003', device_name: 'KA-PC-003', model: 'Dell 7080', project: 'STOCK', pc_image: 'KioskA_v1', parts: [{ name: 'Grid 2', serial_no: 'GRID-77' }], progress: 0 },
];

const categories: { [name: string]: IConfigCategory } = {
  PC: { name: 'PC', icon: 'desktop', uses_image: true, parts: [] },
  'Light Grids': { name: 'Light Grids', icon: 'tools', uses_image: false, parts: ['Grid 2'] },
  'Network Switch': { name: 'Network Switch', icon: 'cogs', uses_image: false, parts: [] },
};

function build(category = 'PC') {
  const service: any = {
    hardwareUnitsDatasource: new MatTableDataSource<any>(units),
    checkIfAdmin: jest.fn(),
    getHardwareUnits: jest.fn(),
    getCatalogue: jest.fn(() => of({ categories: [] })),
    getLocation: jest.fn(() => of({ location: 'Meridian HQ', item_access: [], projects: ['PRJ-ALPHA', 'PRJ-BRAVO'] })),
    category: (name: string) => categories[name],
  };
  const route: any = { paramMap: of(convertToParamMap({ location: 'Meridian HQ', category, type: 'Kiosk A PC' })) };
  const component = new ConfigUnitComponent(service, route);
  component.ngOnInit();
  return { service, component };
}

describe('ConfigUnitComponent', () => {
  it('loads the units of the type in the address, with the catalogue and the location\'s projects', () => {
    const { service, component } = build();
    expect(service.getHardwareUnits).toHaveBeenCalledWith('Meridian HQ', 'PC', 'Kiosk A PC');
    expect(service.getCatalogue).toHaveBeenCalled();
    expect(component.projects).toEqual(['STOCK', 'PRJ-ALPHA', 'PRJ-BRAVO']);
  });

  it('shows the columns the category calls for', () => {
    expect(build('PC').component.displayedColumns).toEqual(['serial_no', 'device_name', 'model', 'project', 'pc_image', 'progress', 'state']);
    expect(build('Network Switch').component.displayedColumns).toEqual(['serial_no', 'device_name', 'model', 'project', 'progress', 'state']);
    expect(build('Light Grids').component.displayedColumns).toContain('parts');
  });

  it('counts the units at each progress', () => {
    const { component } = build();
    expect(component.counts).toEqual({ All: 3, 'Not started': 1, 'In progress': 1, Complete: 1 });
  });

  it('filters by progress', () => {
    const { service, component } = build();
    component.setProgress('In progress');
    expect(service.hardwareUnitsDatasource.filteredData.map(u => u.serial_no)).toEqual(['DL7000-A1002']);
    component.setProgress('All');
    expect(service.hardwareUnitsDatasource.filteredData.length).toBe(3);
  });

  it('filters by project', () => {
    const { service, component } = build();
    component.setProject('STOCK');
    expect(service.hardwareUnitsDatasource.filteredData.map(u => u.serial_no)).toEqual(['DL7080-A1003']);
    component.setProject('PRJ-ALPHA');
    expect(service.hardwareUnitsDatasource.filteredData.length).toBe(2);
    expect(component.projectCount('PRJ-ALPHA')).toBe(2);
    expect(component.projectCount('All')).toBe(3);
  });

  it('offers a project filter for STOCK and the projects that have units', () => {
    expect(build().component.projectChoices).toEqual(['All', 'STOCK', 'PRJ-ALPHA']);
  });

  it('offers the project filter even when the location arrives after the units', () => {
    const { service, component } = build();
    const location = new Subject<any>();
    service.getLocation.mockReturnValue(location);
    component.projects = ['STOCK'];
    component.load();
    expect(component.projectChoices).toEqual(['All', 'STOCK']);
    location.next({ location: 'Meridian HQ', item_access: [], projects: ['PRJ-ALPHA'] });
    expect(component.projectChoices).toEqual(['All', 'STOCK', 'PRJ-ALPHA']);
  });

  it('searches every column that is shown, and the serial no. of a part', () => {
    const { service, component } = build('Light Grids');
    component.setTerm('bravo');
    expect(service.hardwareUnitsDatasource.filteredData.length).toBe(0);
    component.setTerm('grid-77');
    expect(service.hardwareUnitsDatasource.filteredData.map(u => u.serial_no)).toEqual(['DL7080-A1003']);
    component.setTerm('dell 7000');
    component.setProject('PRJ-ALPHA');
    component.setProgress('Complete');
    expect(service.hardwareUnitsDatasource.filteredData.map(u => u.serial_no)).toEqual(['DL7000-A1001']);
  });

  it('sorts by progress, parts and text', () => {
    const { service } = build();
    const access = service.hardwareUnitsDatasource.sortingDataAccessor;
    expect(access(units[1], 'progress')).toBe(60);
    expect(access(units[1], 'state')).toBe(60);
    expect(access(units[2], 'parts')).toBe(1);
    expect(access(units[0], 'serial_no')).toBe('dl7000-a1001');
    expect(access({}, 'model')).toBe('');
  });

  it('describes the parts of a unit for a tooltip', () => {
    const { component } = build('Light Grids');
    expect(component.partsTitle(units[2])).toBe('Grid 2: GRID-77');
    expect(component.partsTitle({ parts: [{ name: 'A', serial_no: '' }] } as any)).toBe('A: –');
    expect(component.partsTitle({} as any)).toBe('');
  });

  it('keeps the same row identity by id', () => {
    const { component } = build();
    expect(component.trackById(0, units[1])).toBe('2');
    expect(component.trackById(4, {} as any)).toBe('4');
  });
});
