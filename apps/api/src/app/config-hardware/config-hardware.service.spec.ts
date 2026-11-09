import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ConfigHardwareService } from './config-hardware.service';

const q = (result: any) => {
  const query: any = { sort: () => query, lean: () => query, exec: () => Promise.resolve(result) };
  return query;
};

const pcCategory = { name: 'PC', icon: 'desktop', uses_image: true, parts: [] };
const w1Category = { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2'] };
const checklistRows = [
  { description: 'Section', reference: 'Heading' },
  { description: 'One', reference: null },
  { description: 'Two', reference: null },
];

const hq = {
  location: 'Meridian HQ',
  item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }, { hardware_category: 'UNIT-W1', hardware_type: ['UNIT-W1 Set'] }],
  image_access: ['img1'],
  hardware_access: ['m1', 'm2'],
  projects: ['PRJ-ALPHA'],
};

interface IOptions {
  user?: any;
  category?: any;
  type?: any;
  place?: any;
  models?: string[];
  images?: string[];
  clash?: any;
  unit?: any;
  updated?: any;
}

function build(options: IOptions = {}) {
  const user = options.user || { username: 'admin', roles: ['ADMIN'], location: [] };
  const units: any = {
    find: jest.fn(() => q([{ serial_no: 'S1' }])),
    findOne: jest.fn(() => q(options.clash || null)),
    findById: jest.fn(() => q(options.unit || null)),
    create: jest.fn((doc: any) => Promise.resolve({ toObject: () => ({ _id: 'new', ...doc }) })),
    findOneAndUpdate: jest.fn(() => q(options.updated === undefined ? { _id: 'u1', saved: true } : options.updated)),
  };
  const deps = {
    users: { findOne: jest.fn(() => q({ username: 'admin', name: 'Alex' })) },
    catalogue: {
      getCategory: jest.fn().mockResolvedValue(options.category || pcCategory),
      getType: jest.fn().mockResolvedValue(options.type || { category: 'PC', name: 'Kiosk A PC', checklist: checklistRows }),
    },
    locations: { getLocation: jest.fn().mockResolvedValue(options.place === undefined ? hq : options.place) },
    hardwareTypes: { getAccessibleByCategory: jest.fn().mockResolvedValue((options.models || ['Dell 7000', 'Dell 7080']).map((name) => ({ name }))) },
    images: { getImageByIds: jest.fn().mockResolvedValue((options.images || ['KioskA_v3']).map((name) => ({ name }))) },
  };
  const service = new ConfigHardwareService(
    units, deps.users as any, { user } as any, deps.catalogue as any, deps.locations as any, deps.hardwareTypes as any, deps.images as any,
  );
  return { service, units, ...deps };
}

const newPc = (extra: any = {}) => ({
  location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC',
  serial_no: ' DL7000-A1 ', model: 'Dell 7000', pc_image: 'KioskA_v3', ...extra,
});

describe('ConfigHardwareService', () => {
  describe('reading', () => {
    it('lists the units of a type by serial no., without their checklists', async () => {
      const { service, units } = build();
      expect(await service.findUnits('Meridian HQ', 'PC', 'Kiosk A PC')).toEqual([{ serial_no: 'S1' }]);
      expect(units.find).toHaveBeenCalledWith({ location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC' }, { checklist: 0 });
    });

    it('opens a unit, but not one in another location unless the user is an administrator', async () => {
      const unit = { _id: 'u1', location: 'Partner A', checklist: [] };
      const id = new Types.ObjectId().toHexString();
      expect(await build({ unit }).service.findUnit(id)).toBe(unit);
      const operator = { username: 'sam', roles: ['OPERATOR'], location: [{ name: 'Meridian HQ' }] };
      await expect(build({ unit, user: operator }).service.findUnit(id)).rejects.toBeInstanceOf(ForbiddenException);
      expect(await build({ unit: { ...unit, location: 'Meridian HQ' }, user: operator }).service.findUnit(id)).toBeTruthy();
    });

    it('says when a unit does not exist or the id is not one', async () => {
      await expect(build().service.findUnit('nope')).rejects.toBeInstanceOf(NotFoundException);
      await expect(build().service.findUnit(new Types.ObjectId().toHexString())).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('adding a unit', () => {
    it('adds it with a tidy serial no., STOCK as its project and the type\'s checklist', async () => {
      const { service, units } = build();
      const created: any = await service.create(newPc());
      expect(created).toMatchObject({
        location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC', serial_no: 'DL7000-A1',
        project: 'STOCK', model: 'Dell 7000', pc_image: 'KioskA_v3', parts: [], progress: 0, version: 0,
      });
      expect(created.checklist.map((r) => r.description)).toEqual(['Section', 'One', 'Two']);
      expect(units.create).toHaveBeenCalledTimes(1);
    });

    it('works out progress from the answers given when it is first saved, stamped with the person\'s name', async () => {
      const { service } = build();
      const created: any = await service.create(newPc({ changes: [{ index: 1, status: 'Complete' }, { index: 2, status: 'Incomplete' }] }));
      expect(created.progress).toBe(50);
      expect(created.checklist[1]).toMatchObject({ status: 'Complete', checked_by: 'Alex' });
    });

    it('allocates it to one of the location\'s projects, tidying the code', async () => {
      expect(((await build().service.create(newPc({ project: ' prj-alpha ' }))) as any).project).toBe('PRJ-ALPHA');
      await expect(build().service.create(newPc({ project: 'PRJ-NOPE' }))).rejects.toThrow('not a project at Meridian HQ');
    });

    it('needs a serial no. and refuses one already in use, naming where only to those who may know', async () => {
      await expect(build().service.create(newPc({ serial_no: '   ' }))).rejects.toThrow('Enter the serial no.');
      const clash = { location: 'Partner A', hardware_type: 'Bio PC' };
      await expect(build({ clash }).service.create(newPc())).rejects.toThrow('Serial no. DL7000-A1 is already used by a Bio PC at Partner A.');
      const operator = { username: 'sam', roles: ['OPERATOR'], location: [{ name: 'Meridian HQ' }] };
      await expect(build({ clash, user: operator }).service.create(newPc())).rejects.toThrow('at another location');
      await expect(build({ clash }).service.create(newPc())).rejects.toBeInstanceOf(ConflictException);
    });

    it('makes the user choose a model when there are several, and fills it in when there is one', async () => {
      await expect(build().service.create(newPc({ model: undefined }))).rejects.toThrow('Choose a model.');
      expect(((await build({ models: ['Only'] }).service.create(newPc({ model: undefined }))) as any).model).toBe('Only');
      await expect(build().service.create(newPc({ model: 'Toaster' }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('only keeps a PC image for categories that use one, and only one the location may use', async () => {
      await expect(build().service.create(newPc({ pc_image: 'Other_v1' }))).rejects.toThrow('not a PC image available');
      const { service, images } = build({ category: { ...pcCategory, uses_image: false }, type: { category: 'PC', name: 'Kiosk A PC', checklist: [] } });
      expect(((await service.create(newPc({ pc_image: 'KioskA_v3' }))) as any).pc_image).toBeNull();
      expect(images.getImageByIds).not.toHaveBeenCalled();
    });

    it('keeps the parts a category defines, each with its serial no.', async () => {
      const { service } = build({ category: w1Category, type: { category: 'UNIT-W1', name: 'UNIT-W1 Set', checklist: [] }, models: ['W1 Controller'] });
      const created: any = await service.create({
        location: 'Meridian HQ', hardware_category: 'UNIT-W1', hardware_type: 'UNIT-W1 Set', serial_no: 'W1-SET-1',
        parts: [{ name: 'Unit W1-1', serial_no: 'A1' }, { name: 'Unit W1-2', serial_no: 'A2' }, { name: 'Bogus', serial_no: 'Z' }],
      });
      expect(created.parts).toEqual([{ name: 'Unit W1-1', serial_no: 'A1' }, { name: 'Unit W1-2', serial_no: 'A2' }]);
      expect(created.model).toBe('W1 Controller');
    });

    it('refuses a type from another category or one the location is not set up for', async () => {
      await expect(build({ type: { category: 'Printer', name: 'Kiosk A PC', checklist: [] } }).service.create(newPc())).rejects.toThrow('not a PC hardware type');
      const noAccess = { ...hq, item_access: [] };
      await expect(build({ place: noAccess }).service.create(newPc())).rejects.toThrow('not set up to configure Kiosk A PC');
      await expect(build({ place: null }).service.create(newPc())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to add a unit at a location the user does not belong to', async () => {
      const operator = { username: 'sam', roles: ['OPERATOR'], location: [{ name: 'Partner A' }] };
      await expect(build({ user: operator }).service.create(newPc())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('saving a unit', () => {
    const id = new Types.ObjectId().toHexString();
    const existing = (extra: any = {}) => ({
      _id: id, location: 'Meridian HQ', hardware_category: 'PC', hardware_type: 'Kiosk A PC', serial_no: 'DL7000-A1',
      model: 'Dell 7000', pc_image: 'KioskA_v3', project: 'STOCK', parts: [], version: 2, progress: 50,
      checklist: [
        { description: 'Section', reference: 'Heading' },
        { description: 'One', reference: null, status: 'Complete', checked_by: 'Alex', date_checked: 'd', comment: null },
        { description: 'Two', reference: null, status: null, checked_by: null, date_checked: null, comment: null },
      ], ...extra,
    });

    it('works progress out from the whole checklist, not just the rows changed in this save', async () => {
      const { service, units } = build({ unit: existing() });
      await service.update({ id, version: 2, changes: [{ index: 2, status: 'N/A' }] });
      const [filter, update] = units.findOneAndUpdate.mock.calls[0];
      expect(update.$set.progress).toBe(100);
      expect(update.$set.checklist[1].checked_by).toBe('Alex');
      expect(update.$set.checklist[2]).toMatchObject({ status: 'N/A', checked_by: 'Alex' });
      expect(update.$inc).toEqual({ version: 1 });
      expect(String(filter._id)).toBe(id);
      expect(filter.version).toBe(2);
    });

    it('refuses a save made from an older copy', async () => {
      const { service, units } = build({ unit: existing() });
      await expect(service.update({ id, version: 1, changes: [] })).rejects.toBeInstanceOf(ConflictException);
      expect(units.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('refuses a save that someone else slipped in front of, even after the first check', async () => {
      const { service } = build({ unit: existing(), updated: null });
      await expect(service.update({ id, version: 2 })).rejects.toThrow('changed by someone else');
    });

    it('matches a unit with no version yet as version 0', async () => {
      const { service, units } = build({ unit: existing({ version: undefined }) });
      await service.update({ id, version: 0 });
      expect(units.findOneAndUpdate.mock.calls[0][0].version).toEqual({ $in: [0, null] });
    });

    it('keeps what was not sent, and moves the unit to another project', async () => {
      const { service, units } = build({ unit: existing() });
      await service.update({ id, version: 2, project: 'prj-alpha', device_name: ' KA-1 ' });
      const set = units.findOneAndUpdate.mock.calls[0][1].$set;
      expect(set).toMatchObject({ project: 'PRJ-ALPHA', device_name: 'KA-1', serial_no: 'DL7000-A1', model: 'Dell 7000', pc_image: 'KioskA_v3' });
    });

    it('lets a unit keep its own serial no. but not take another unit\'s', async () => {
      const { service, units } = build({ unit: existing() });
      await service.update({ id, version: 2 });
      expect(units.findOne.mock.calls[0][0]._id).toEqual({ $ne: id });
      await expect(build({ unit: existing(), clash: { location: 'Meridian HQ', hardware_type: 'Bio PC' } }).service.update({ id, version: 2, serial_no: 'TAKEN' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps a model the unit has even when the location\'s models have since changed', async () => {
      const { service, units } = build({ unit: existing({ model: 'Retired' }), models: ['Dell 7000', 'Dell 7080'] });
      await service.update({ id, version: 2 });
      expect(units.findOneAndUpdate.mock.calls[0][1].$set.model).toBe('Retired');
    });

    it('refuses to save a unit in another location', async () => {
      const operator = { username: 'sam', roles: ['OPERATOR'], location: [{ name: 'Partner A' }] };
      await expect(build({ unit: existing(), user: operator }).service.update({ id, version: 2 })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
