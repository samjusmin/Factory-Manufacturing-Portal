import { FormBuilder } from '@angular/forms';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ConfigUnitFormComponent } from './config-unit-form.component';

const pc = { name: 'PC', icon: 'desktop', uses_image: true, parts: [] as string[], types: ['Kiosk A PC'] };
const w1 = { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2'], types: ['UNIT-W1 Set'] };
const grid = { name: 'Light Grids', icon: 'tools', uses_image: false, parts: [], types: ['Light Grid - X'] };

const template = (rows: any[]) => ({ category: 'PC', name: 'Kiosk A PC', checklist: rows });
const blank = (description: string, reference: string | null = null) => ({ description, reference, status: null, checked_by: null, date_checked: null, comment: null });

const savedUnit = (extra: any = {}) => ({
  _id: 'u1', location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC', serial_no: 'DL7000-A1',
  device_name: 'KA-1', model: 'Dell 7000', pc_image: 'KioskA_v3', project: 'PRJ-ALPHA', parts: [], progress: 50, version: 3,
  checklist: [
    { description: 'Section', reference: 'Heading' },
    { ...blank('One'), status: 'Complete', checked_by: 'Alex', date_checked: '2026-10-01' },
    blank('Two'),
  ], ...extra,
});

interface IOptions {
  id?: string;
  category?: any;
  models?: string[];
  images?: string[];
  projects?: string[];
  unit?: any;
  rows?: any[];
}

function build(options: IOptions = {}) {
  const category = options.category || pc;
  const service: any = {
    getCatalogue: jest.fn(() => of({ categories: [pc, w1, grid] })),
    getLocation: jest.fn(() => of({ location: 'Meridian HQ', item_access: [], projects: options.projects || ['PRJ-ALPHA', 'PRJ-BRAVO'] })),
    getCatalogueType: jest.fn(() => of(template(options.rows || [blank('Section', 'Heading'), blank('One'), blank('Two')]))),
    getUnit: jest.fn(() => of(options.unit || savedUnit())),
    getAccessibleHardware: jest.fn(() => of((options.models || ['Dell 7000', 'Dell 7080']).map((name) => ({ name })))),
    getAccessibleImages: jest.fn(() => of((options.images || ['KioskA_v3']).map((name) => ({ name })))),
    createUnit: jest.fn((payload: any) => of(savedUnit({ serial_no: payload.serial_no, version: 0, progress: 0 }))),
    updateUnit: jest.fn((payload: any) => of(savedUnit({ version: payload.version + 1 }))),
    goBack: jest.fn(),
  };
  const router: any = { navigate: jest.fn() };
  const dialog: any = { open: jest.fn(() => ({ afterClosed: () => of(true) })) };
  const snackBar: any = { open: jest.fn() };
  const route: any = { paramMap: of(convertToParamMap({ location: 'Meridian HQ', category: category.name, type: 'Kiosk A PC', id: options.id || 'add-unit' })) };
  service.getCatalogue = jest.fn(() => of({ categories: [category, pc, w1, grid].filter((c, i, all) => all.findIndex(x => x.name === c.name) === i) }));
  const component = new ConfigUnitFormComponent(service, route, router, new FormBuilder(), dialog, snackBar);
  component.ngOnInit();
  return { service, router, dialog, snackBar, component };
}

const fill = (component: ConfigUnitFormComponent, values: any) => component.form.patchValue(values);

describe('ConfigUnitFormComponent', () => {
  describe('a new unit', () => {
    it('starts from the type\'s checklist with nothing answered, and is called "New <type>"', () => {
      const { component, service } = build();
      expect(component.loaded).toBe(true);
      expect(component.isNew).toBe(true);
      expect(component.title).toBe('New Kiosk A PC');
      expect(service.getCatalogueType).toHaveBeenCalledWith('Kiosk A PC');
      expect(service.getUnit).not.toHaveBeenCalled();
      expect(component.rows.map((r) => r.description)).toEqual(['Section', 'One', 'Two']);
      expect(component.rows.every((r) => !r.status)).toBe(true);
    });

    it('allocates to STOCK by default and offers the location\'s projects', () => {
      const { component } = build();
      expect(component.form.value.project).toBe('STOCK');
      expect(component.projectChoices).toEqual(['STOCK', 'PRJ-ALPHA', 'PRJ-BRAVO']);
    });

    it('makes the user choose a model when the location has several', () => {
      const { component } = build();
      expect(component.modelOptions).toEqual(['Dell 7000', 'Dell 7080']);
      expect(component.form.value.model).toBe('');
      expect(component.form.get('model').hasError('required')).toBe(true);
    });

    it('fills the model in when there is only one', () => {
      const { component } = build({ category: w1, models: ['W1 Controller'] });
      expect(component.modelOptions).toEqual(['W1 Controller']);
      expect(component.form.value.model).toBe('W1 Controller');
      expect(component.form.get('model').valid).toBe(true);
    });

    it('has no model when none are set up', () => {
      const { component } = build({ category: grid, models: [] });
      expect(component.modelOptions).toEqual([]);
      expect(component.form.value.model).toBe('');
      expect(component.form.get('model').valid).toBe(true);
    });

    it('asks for PC images only for a category that uses them', () => {
      const withImage = build();
      expect(withImage.service.getAccessibleImages).toHaveBeenCalledWith('Meridian HQ', 'Kiosk A PC');
      expect(withImage.component.imageChoices).toEqual(['KioskA_v3']);
      const without = build({ category: w1, models: ['W1 Controller'] });
      expect(without.service.getAccessibleImages).not.toHaveBeenCalled();
    });

    it('has a serial box for each part the category defines', () => {
      const { component } = build({ category: w1, models: ['W1 Controller'] });
      expect(component.partControls.length).toBe(2);
      const none = build();
      expect(none.component.partControls.length).toBe(0);
    });

    it('will not save without a serial no., and says so', () => {
      const { component, service, snackBar } = build();
      fill(component, { model: 'Dell 7000', serial_no: '   ' });
      component.saveChanges();
      expect(service.createUnit).not.toHaveBeenCalled();
      expect(component.form.get('serial_no').hasError('required')).toBe(true);
      expect(snackBar.open).toHaveBeenCalledWith('Check the fields marked in red.', 'OK', expect.anything());
    });

    it('will not save while the model is still to choose', () => {
      const { component, service } = build();
      fill(component, { serial_no: 'DL7000-A1' });
      component.saveChanges();
      expect(service.createUnit).not.toHaveBeenCalled();
    });

    it('adds the unit with its details and only the checks that were answered, then moves to its address', () => {
      const { component, service, router } = build();
      fill(component, { serial_no: ' DL7000-A1 ', device_name: 'KA-1', model: 'Dell 7000', pc_image: 'KioskA_v3', project: 'PRJ-ALPHA' });
      component.chooseStatus(component.rows[1], 'Complete');
      component.rows[2].comment = 'waiting for the image';
      component.saveChanges();

      expect(service.createUnit).toHaveBeenCalledWith({
        location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC',
        serial_no: 'DL7000-A1', device_name: 'KA-1', model: 'Dell 7000', pc_image: 'KioskA_v3', project: 'PRJ-ALPHA', parts: [],
        changes: [{ index: 1, status: 'Complete', comment: null }, { index: 2, status: null, comment: 'waiting for the image' }],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/config-hardware-checklist', 'Meridian HQ', 'PC', 'Kiosk A PC', 'u1'], { replaceUrl: true });
      expect(component.id).toBe('u1');
      expect(component.isNew).toBe(false);
      expect(component.saveState).toBe('saved');
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('sends each part\'s serial no. and leaves the image out for a category without images', () => {
      const { component, service } = build({ category: w1, models: ['W1 Controller'] });
      fill(component, { serial_no: 'W1-SET-1', pc_image: 'ignored' });
      component.partControls[1].setValue('MEMBER-2');
      component.saveChanges();
      const payload = service.createUnit.mock.calls[0][0];
      expect(payload.pc_image).toBeNull();
      expect(payload.parts).toEqual([{ name: 'Unit W1-1', serial_no: '' }, { name: 'Unit W1-2', serial_no: 'MEMBER-2' }]);
      expect(payload.model).toBe('W1 Controller');
    });

    it('shows the server\'s reason beside the serial no. when it is already used', () => {
      const { component, service, router } = build();
      service.createUnit.mockReturnValueOnce(throwError({ status: 409, error: { message: 'Serial no. DL7000-A1 is already used by a Bio PC at Partner A.' } }));
      fill(component, { serial_no: 'DL7000-A1', model: 'Dell 7000' });
      component.saveChanges();
      expect(component.form.get('serial_no').getError('taken')).toBe('Serial no. DL7000-A1 is already used by a Bio PC at Partner A.');
      expect(component.saveState).toBe('');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.isNew).toBe(true);
    });

    it('keeps the edits and says why when the server refuses for another reason', () => {
      const { component, service, snackBar } = build();
      service.createUnit.mockReturnValueOnce(throwError({ status: 400, error: { message: 'NOPE is not a project at Meridian HQ.' } }));
      fill(component, { serial_no: 'X1', model: 'Dell 7000' });
      component.saveChanges();
      expect(component.saveState).toBe('failed');
      expect(snackBar.open).toHaveBeenCalledWith('NOPE is not a project at Meridian HQ.', 'OK', expect.anything());
    });
  });

  describe('an existing unit', () => {
    const open = (options: IOptions = {}) => build({ id: 'u1', ...options });

    it('shows the unit, titled by its serial no., with the saved version and progress', () => {
      const { component, service } = open();
      expect(service.getUnit).toHaveBeenCalledWith('u1');
      expect(service.getCatalogueType).not.toHaveBeenCalled();
      expect(component.title).toBe('DL7000-A1');
      expect(component.version).toBe(3);
      expect(component.form.value).toMatchObject({ serial_no: 'DL7000-A1', device_name: 'KA-1', model: 'Dell 7000', project: 'PRJ-ALPHA', pc_image: 'KioskA_v3' });
    });

    it('has nothing to save until something changes', () => {
      const { component } = open();
      expect(component.hasUnsavedChanges()).toBe(false);
      expect(component.canSave).toBe(false);
      component.chooseStatus(component.rows[2], 'N/A');
      expect(component.hasUnsavedChanges()).toBe(true);
      expect(component.canSave).toBe(true);
      expect(component.changedRows).toEqual([component.rows[2]]);
      component.chooseStatus(component.rows[2], 'N/A');
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('counts a change to the details as unsaved', () => {
      const { component } = open();
      component.form.get('project').setValue('PRJ-BRAVO');
      component.form.get('project').markAsDirty();
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('keeps a model the location no longer lists', () => {
      const { component } = open({ unit: savedUnit({ model: 'Retired' }) });
      expect(component.modelOptions).toEqual(['Dell 7000', 'Dell 7080', 'Retired']);
      expect(component.form.value.model).toBe('Retired');
    });

    it('saves only the changed checks, with the version it loaded', () => {
      const { component, service } = open();
      component.chooseStatus(component.rows[2], 'Complete');
      component.form.get('project').setValue('STOCK');
      component.form.get('project').markAsDirty();
      component.saveChanges();
      expect(service.updateUnit).toHaveBeenCalledTimes(1);
      const payload = service.updateUnit.mock.calls[0][0];
      expect(payload).toMatchObject({ id: 'u1', version: 3, project: 'STOCK', serial_no: 'DL7000-A1' });
      expect(payload.changes).toEqual([{ index: 2, status: 'Complete', comment: null }]);
      expect(component.version).toBe(4);
      expect(component.saveState).toBe('saved');
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('shows how far the checks have got from the answers on screen', () => {
      const { component } = open();
      expect([component.doneCount, component.checkList.length, component.donePercent]).toEqual([1, 2, 50]);
      component.chooseStatus(component.rows[2], 'Incomplete');
      expect(component.donePercent).toBe(50);
      component.chooseStatus(component.rows[2], 'Incomplete');
      component.chooseStatus(component.rows[2], 'N/A');
      expect(component.donePercent).toBe(100);
    });

    it('groups the checks under their headings', () => {
      const { component } = open();
      expect(component.sections.length).toBe(1);
      expect(component.sections[0].heading.description).toBe('Section');
      expect(component.sections[0].rows.map((r) => r.description)).toEqual(['One', 'Two']);
    });

    it('marks only the unanswered checks Complete, after asking', () => {
      const { component, dialog } = open();
      component.chooseStatus(component.rows[2], 'Incomplete');
      expect(component.allUnchecked).toEqual([]);
      component.chooseStatus(component.rows[2], 'Incomplete');
      expect(component.allUnchecked).toEqual([component.rows[2]]);
      component.markComplete(component.checkList, 'this checklist');
      expect(dialog.open).toHaveBeenCalled();
      expect(component.rows[2].status).toBe('Complete');
      expect(component.rows[1].status).toBe('Complete');
    });

    it('says why when the unit cannot be loaded', () => {
      const { component, service } = open();
      service.getUnit.mockReturnValueOnce(throwError({ status: 403, error: { message: 'You do not have access to that location.' } }));
      component.load();
      expect(component.loaded).toBe(true);
      expect(component.loadMessage).toBe('You do not have access to that location.');
    });
  });

  describe('when someone else saved the unit first', () => {
    const changed = 'This unit was changed by someone else.';

    function conflict() {
      const built = build({ id: 'u1' });
      const theirs = savedUnit({
        version: 4, progress: 100,
        checklist: [
          { description: 'Section', reference: 'Heading' },
          { ...blank('One'), status: 'Complete', checked_by: 'Alex', date_checked: '2026-10-01' },
          { ...blank('Two'), status: 'Complete', checked_by: 'Sam', date_checked: '2026-11-02', comment: 'theirs' },
        ],
      });
      built.service.updateUnit.mockReturnValueOnce(throwError({ status: 409, error: { message: changed } }));
      built.service.getUnit.mockReturnValueOnce(of(theirs));
      return built;
    }

    it('shows what they saved, keeps the user\'s other edits and does not save by itself', () => {
      const { component, service } = conflict();
      component.form.get('device_name').setValue('Mine');
      component.form.get('device_name').markAsDirty();
      component.saveChanges();
      expect(service.getUnit).toHaveBeenLastCalledWith('u1');
      expect(component.rows[2].status).toBe('Complete');
      expect(component.rows[2].comment).toBe('theirs');
      expect(component.version).toBe(4);
      expect(component.form.value.device_name).toBe('Mine');
      expect(component.mergeNotice).toContain('Someone else saved this unit while you were working.');
      expect(component.mergeNotice).toContain('Your changes to the details are kept.');
      expect(component.saveState).toBe('');
      expect(service.updateUnit).toHaveBeenCalledTimes(1);
    });

    it('makes the user settle a check that both of them changed before saving', () => {
      const { component } = conflict();
      component.chooseStatus(component.rows[2], 'Incomplete');
      component.saveChanges();
      expect(component.unresolvedCount).toBe(1);
      expect(component.canSave).toBe(false);
      const clash = component.conflictFor(component.rows[2]);
      expect(clash.theirs.status).toBe('Complete');
      component.useTheirs(clash);
      expect(component.rows[2].status).toBe('Complete');
      expect(component.rows[2].comment).toBe('theirs');
      expect(component.unresolvedCount).toBe(0);
      expect(component.conflictFor(component.rows[2])).toBeNull();
    });

    it('lets the user keep their own answer for a clash', () => {
      const { component } = conflict();
      component.chooseStatus(component.rows[2], 'Incomplete');
      component.saveChanges();
      component.keepMine(component.conflictFor(component.rows[2]));
      expect(component.rows[2].status).toBe('Incomplete');
      expect(component.unresolvedCount).toBe(0);
      expect(component.canSave).toBe(true);
    });
  });
});
