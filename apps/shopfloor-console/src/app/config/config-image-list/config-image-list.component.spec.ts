import { of, throwError } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { ConfigImageListComponent } from './config-image-list.component';

describe('ConfigImageListComponent', () => {
  let service: any;
  let dialog: any;
  let snackBar: any;
  let component: ConfigImageListComponent;

  beforeEach(() => {
    service = {
      imageList: new MatTableDataSource<any>([{ _id: '1', name: 'KioskA_v3', description: 'Standard build', added_by: 'admin', responsible_person: 'Alex', pc_type: 'Kiosk A PC', date_created: '2026-09-01' }]),
      checkIfAdmin: jest.fn(),
      getImageList: jest.fn(),
      updateImageList: jest.fn(() => of({})),
      getImageTypes: jest.fn(() => of(['Kiosk A PC', 'Bio PC'])),
    };
    dialog = { open: jest.fn() };
    snackBar = { open: jest.fn() };
    component = new ConfigImageListComponent(service, dialog, { detectChanges: jest.fn() } as any, snackBar);
    (component as any).table = { renderRows: jest.fn() };
  });

  it('loads the images, and the hardware types an image can be made for', () => {
    component.ngOnInit();
    expect(service.getImageList).toHaveBeenCalled();
    expect(component.pcTypes).toEqual(['Kiosk A PC', 'Bio PC']);
    expect(component.displayedColumns).toEqual(['name', 'description', 'added_by', 'responsible_person', 'pc_type', 'date_created', 'isEdit']);
  });

  it('turns a date into the form a date field takes', () => {
    expect(component.formatDateForInput('03/11/2026')).toBe('2026-11-03');
    expect(component.formatDateForInput('2026-11-03T10:00:00.000Z')).toBe('2026-11-03');
    expect(component.formatDateForInput('2026-11-03')).toBe('2026-11-03');
    expect(component.formatDateForInput(null)).toBe('');
    expect(component.formatDateForInput('soon')).toBe('');
  });

  it('starts editing with the date ready for the date field', () => {
    const row = service.imageList.data[0];
    component.editRow(row);
    expect(row.isEdit).toBe(true);
    expect(row.date_created_edit).toBe('2026-09-01');
  });

  it('adds an empty row to fill in', () => {
    component.addImage();
    expect(service.imageList.data.length).toBe(2);
    expect(service.imageList.data[0].isEdit).toBe(true);
  });

  it('will not save an image with a field left empty', () => {
    component.addImage();
    const row = service.imageList.data[0];
    row.name = 'New image';
    component.saveChanges(row);
    expect(dialog.open).toHaveBeenCalled();
    expect(service.updateImageList).not.toHaveBeenCalled();
    expect(row.isEdit).toBe(true);
  });

  it('saves a complete image and reloads the list', () => {
    const row = service.imageList.data[0];
    row.date_created_edit = '2026-10-01';
    component.saveChanges(row);
    expect(row.date_created).toBe('2026-10-01');
    expect(service.updateImageList).toHaveBeenCalledWith(row);
    expect(service.getImageList).toHaveBeenCalled();
    expect(row.isEdit).toBe(false);
  });

  it('keeps the row open and says why when the server refuses the image', () => {
    const row = service.imageList.data[0];
    row.date_created_edit = '2026-10-01';
    service.updateImageList.mockReturnValueOnce(throwError({ status: 409, error: { message: 'There is already an image called "KioskA_v3".' } }));
    component.saveChanges(row);
    expect(snackBar.open).toHaveBeenCalledWith('There is already an image called "KioskA_v3".', 'OK', expect.anything());
    expect(service.getImageList).not.toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });

  it('takes a discarded row off the screen, even with a filter on', () => {
    service.imageList.filterPredicate = () => true;
    service.imageList.filter = 'anything';
    const before = service.imageList.filteredData.length;
    component.addImage();
    const added = service.imageList.data[0];
    expect(service.imageList.filteredData.length).toBe(before + 1);
    component.cancelEntry(added);
    expect(service.imageList.filteredData.length).toBe(before);
    expect(service.imageList.filteredData).not.toContain(added);
  });

  it('discards a new row but only reloads for a saved one', () => {
    component.addImage();
    component.cancelEntry(service.imageList.data[0]);
    expect(service.imageList.data.length).toBe(1);
    expect(service.getImageList).not.toHaveBeenCalled();

    const saved = service.imageList.data[0];
    saved.isEdit = true;
    component.cancelEntry(saved);
    expect(saved.isEdit).toBe(false);
    expect(service.getImageList).toHaveBeenCalled();
  });

  describe('searching and filtering', () => {
    const shown = () => service.imageList.filteredData.map((i: any) => i.name);

    beforeEach(() => {
      service.imageList.data = [
        { _id: '1', name: 'KioskA_v3', description: 'Standard', added_by: 'Alex', responsible_person: 'Sam', pc_type: 'Kiosk A PC' },
        { _id: '2', name: 'Bio_v1', description: 'Biometric', added_by: 'Sam', responsible_person: 'Sam', pc_type: 'Bio PC' },
      ];
      component.ngOnInit();
    });

    it('searches what the row shows', () => {
      component.applyFilter(' biometric ');
      expect(shown()).toEqual(['Bio_v1']);
    });

    it('filters, together with the search, and clears', () => {
      component.setSelection({ pc_type: ['Kiosk A PC', 'Bio PC'], added_by: ['Alex'] });
      expect(shown()).toEqual(['KioskA_v3']);
      expect(component.hasFilters).toBe(true);
      component.applyFilter('bio');
      expect(shown()).toEqual([]);
      component.clearFilters();
      expect(shown()).toEqual(['Bio_v1']);
      expect(component.hasFilters).toBe(false);
    });

    it('keeps a row being added in view, whatever is filtered', () => {
      component.setSelection({ pc_type: ['Bio PC'] });
      component.addImage();
      expect(shown()).toEqual(['', 'Bio_v1']);
    });

    it('offers the catalogue types and the people on the list, without rebuilding each time', () => {
      const groups = component.filterGroups;
      expect(groups.map((g) => g.key)).toEqual(['pc_type', 'added_by', 'responsible_person']);
      expect(groups[0].options.map((o) => o.value)).toEqual(['Bio PC', 'Kiosk A PC']);
      expect(groups[1].options.map((o) => o.value)).toEqual(['Alex', 'Sam']);
      expect(component.filterGroups).toBe(groups);
    });
  });
});
