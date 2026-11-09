import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ConfigCatalogueDialogComponent, NEW_CATEGORY, parsePartNames } from './config-catalogue-dialog.component';

const pc = { name: 'PC', icon: 'desktop', uses_image: true, parts: [] as string[], types: ['Kiosk A PC'] };
const w1 = { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2'], types: [] as string[] };

function build(data: any) {
  const service: any = {
    catalogue: { categories: [pc, w1] },
    createCategory: jest.fn(() => of({})),
    createType: jest.fn(() => of({})),
    updateCategory: jest.fn(() => of({})),
    deleteCategory: jest.fn(() => of({})),
  };
  const dialogRef: any = { close: jest.fn() };
  const dialog: any = { open: jest.fn(() => ({ afterClosed: () => of(true) })) };
  const component = new ConfigCatalogueDialogComponent(data, dialogRef, new FormBuilder(), dialog, service);
  return { component, service, dialogRef, dialog };
}

describe('parsePartNames', () => {
  it('splits on lines and commas, tidying each name', () => {
    expect(parsePartNames('Unit W1-1\n  Unit   W1-2 , Grid 2,, ')).toEqual(['Unit W1-1', 'Unit W1-2', 'Grid 2']);
    expect(parsePartNames('')).toEqual([]);
    expect(parsePartNames(null)).toEqual([]);
  });
});

describe('ConfigCatalogueDialogComponent', () => {
  describe('adding a hardware type', () => {
    it('starts in the category it was opened from, or the first one', () => {
      expect(build({ mode: 'type', category: w1 }).component.form.value.category).toBe('UNIT-W1');
      expect(build({ mode: 'type' }).component.form.value.category).toBe('PC');
    });

    it('adds the type to an existing category and closes', () => {
      const { component, service, dialogRef } = build({ mode: 'type' });
      component.form.patchValue({ category: 'PC', name: ' Bio PC ' });
      component.save();
      expect(service.createCategory).not.toHaveBeenCalled();
      expect(service.createType).toHaveBeenCalledWith({ category: 'PC', name: 'Bio PC' });
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('makes the new category first, with its icon, image setting and parts', () => {
      const { component, service } = build({ mode: 'type' });
      component.form.patchValue({ category: NEW_CATEGORY, newName: ' Racks ', name: 'R-1', icon: 'cubes', uses_image: false, parts: 'Door\nRoof' });
      expect(component.showsCategoryFields).toBe(true);
      component.save();
      expect(service.createCategory).toHaveBeenCalledWith({ name: 'Racks', icon: 'cubes', uses_image: false, parts: ['Door', 'Roof'] });
      expect(service.createType).toHaveBeenCalledWith({ category: 'Racks', name: 'R-1' });
    });

    it('needs a name for the type and for a new category', () => {
      const { component, service } = build({ mode: 'type' });
      component.save();
      expect(component.error).toBe('Give the hardware type a name.');
      component.form.patchValue({ category: NEW_CATEGORY, name: 'R-1' });
      component.save();
      expect(component.error).toBe('Give the new category a name.');
      expect(service.createType).not.toHaveBeenCalled();
    });

    it('shows the server\'s reason and stays open', () => {
      const { component, service, dialogRef } = build({ mode: 'type' });
      service.createType.mockReturnValueOnce(throwError({ status: 409, error: { message: 'There is already a hardware type called "Bio PC".' } }));
      component.form.patchValue({ category: 'PC', name: 'Bio PC' });
      component.save();
      expect(component.error).toBe('There is already a hardware type called "Bio PC".');
      expect(component.saving).toBe(false);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('stops at the category when it cannot be made', () => {
      const { component, service } = build({ mode: 'type' });
      service.createCategory.mockReturnValueOnce(throwError({ status: 409, error: { message: 'There is already a category called "Racks".' } }));
      component.form.patchValue({ category: NEW_CATEGORY, newName: 'Racks', name: 'R-1' });
      component.save();
      expect(component.error).toBe('There is already a category called "Racks".');
      expect(service.createType).not.toHaveBeenCalled();
    });
  });

  describe('changing a category', () => {
    it('shows the category\'s own settings', () => {
      const { component } = build({ mode: 'category', category: w1 });
      expect(component.isType).toBe(false);
      expect(component.showsCategoryFields).toBe(true);
      expect(component.form.value).toMatchObject({ icon: 'cubes', uses_image: false, parts: 'Unit W1-1\nUnit W1-2' });
    });

    it('saves them', () => {
      const { component, service, dialogRef } = build({ mode: 'category', category: w1 });
      component.form.patchValue({ icon: 'tools', uses_image: true, parts: 'Member 1' });
      component.save();
      expect(service.updateCategory).toHaveBeenCalledWith('UNIT-W1', { icon: 'tools', uses_image: true, parts: ['Member 1'] });
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('only offers to delete a category that has no types, and asks first', () => {
      expect(build({ mode: 'category', category: pc }).component.canDeleteCategory).toBe(false);
      const { component, service, dialog, dialogRef } = build({ mode: 'category', category: w1 });
      expect(component.canDeleteCategory).toBe(true);
      component.deleteCategory();
      expect(dialog.open).toHaveBeenCalled();
      expect(service.deleteCategory).toHaveBeenCalledWith('UNIT-W1');
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });
  });
});
