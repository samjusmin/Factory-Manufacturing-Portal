import { of, throwError } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { ConfigHardwareListComponent } from './config-hardware-list.component';

describe('ConfigHardwareListComponent', () => {
  let service: any;
  let dialog: any;
  let snackBar: any;
  let component: ConfigHardwareListComponent;

  beforeEach(() => {
    service = {
      hardwareList: new MatTableDataSource<any>([{ _id: '1', name: 'Dell 7000', config_type: ['PC'] }]),
      checkIfAdmin: jest.fn(),
      getHardwareList: jest.fn(),
      updateHardwareUnits: jest.fn(() => of({})),
      getCatalogue: jest.fn(() => of({ categories: [{ name: 'PC' }, { name: 'Network Switch' }] })),
    };
    dialog = { open: jest.fn() };
    snackBar = { open: jest.fn() };
    component = new ConfigHardwareListComponent(service, dialog, { detectChanges: jest.fn() } as any, snackBar);
    (component as any).table = { renderRows: jest.fn() };
  });

  it('loads the hardware, and the categories from the catalogue', () => {
    component.ngOnInit();
    expect(service.getHardwareList).toHaveBeenCalled();
    expect(component.configTypes).toEqual(['PC', 'Network Switch']);
    expect(component.displayedColumns).toEqual(['name', 'config_type', 'isEdit']);
  });

  it('adds an empty row to fill in', () => {
    component.addImage();
    expect(service.hardwareList.data[0]).toEqual({ name: '', config_type: [], isEdit: true });
  });

  it('will not save hardware without a name or a type', () => {
    component.addImage();
    const row = service.hardwareList.data[0];
    component.saveChanges(row);
    expect(dialog.open).toHaveBeenCalled();
    expect(service.updateHardwareUnits).not.toHaveBeenCalled();
  });

  it('saves complete hardware and reloads the list', () => {
    const row = service.hardwareList.data[0];
    component.editRow(row);
    expect(row.isEdit).toBe(true);
    component.saveChanges(row);
    expect(service.updateHardwareUnits).toHaveBeenCalledWith(row);
    expect(service.getHardwareList).toHaveBeenCalled();
    expect(row.isEdit).toBe(false);
  });

  it('keeps the row open and says why when the server refuses the hardware', () => {
    const row = service.hardwareList.data[0];
    service.updateHardwareUnits.mockReturnValueOnce(throwError({ status: 409, error: { message: 'There is already hardware called "Dell 7000".' } }));
    component.saveChanges(row);
    expect(snackBar.open).toHaveBeenCalledWith('There is already hardware called "Dell 7000".', 'OK', expect.anything());
    expect(service.getHardwareList).not.toHaveBeenCalled();
  });

  it('takes a discarded row off the screen, even with a filter on', () => {
    service.hardwareList.filterPredicate = () => true;
    service.hardwareList.filter = 'anything';
    const before = service.hardwareList.filteredData.length;
    component.addImage();
    const added = service.hardwareList.data[0];
    expect(service.hardwareList.filteredData.length).toBe(before + 1);
    component.cancelEntry(added);
    expect(service.hardwareList.filteredData.length).toBe(before);
    expect(service.hardwareList.filteredData).not.toContain(added);
  });

  it('discards a new row', () => {
    component.addImage();
    component.cancelEntry(service.hardwareList.data[0]);
    expect(service.hardwareList.data.length).toBe(1);
  });

  describe('searching and filtering', () => {
    const shown = () => service.hardwareList.filteredData.map((h: any) => h.name);

    beforeEach(() => {
      service.hardwareList.data = [{ _id: '1', name: 'Dell 7000', config_type: ['PC'] }, { _id: '2', name: 'DGS-1005', config_type: ['Network Switch'] }];
      component.ngOnInit();
    });

    it('searches the name and the type', () => {
      component.applyFilter('dgs');
      expect(shown()).toEqual(['DGS-1005']);
      component.applyFilter('network');
      expect(shown()).toEqual(['DGS-1005']);
    });

    it('filters by config type and clears', () => {
      component.setSelection({ config_type: ['PC'] });
      expect(shown()).toEqual(['Dell 7000']);
      component.clearFilters();
      expect(shown().length).toBe(2);
    });

    it('keeps a row being added in view, whatever is filtered', () => {
      component.setSelection({ config_type: ['PC'] });
      component.addImage();
      expect(shown()).toEqual(['', 'Dell 7000']);
    });

    it('offers the categories from the catalogue', () => {
      const groups = component.filterGroups;
      expect(groups[0].options.map((o) => o.value)).toEqual(['Network Switch', 'PC']);
      expect(component.filterGroups).toBe(groups);
    });
  });
});
