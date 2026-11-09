import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigLocationService } from './config-location.service';

const q = (result: any) => {
  const query: any = { lean: () => query, exec: () => Promise.resolve(result) };
  return query;
};

const hq = () => ({
  location: 'Meridian HQ',
  item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Bio PC'] }],
  image_access: ['i1'], hardware_access: ['m1'], projects: ['PRJ-ALPHA', 'PRJ-BRAVO'],
});

function build(options: { docs?: any[]; used?: { [key: string]: number }; typeOk?: boolean } = {}) {
  const docs = options.docs || [hq(), { location: 'Partner A', item_access: [] }];
  const model: any = {
    find: jest.fn(() => q(docs)),
    findOne: jest.fn((filter: any) => q(docs.find((d) => d.location === filter.location) || null)),
    findOneAndUpdate: jest.fn((filter: any, update: any) => q({ ...docs.find((d) => d.location === filter.location), ...update.$set })),
    create: jest.fn((doc: any) => Promise.resolve({ toObject: () => doc })),
  };
  const units: any = { countDocuments: jest.fn((filter: any) => Promise.resolve((options.used || {})[filter.project || filter.hardware_type] || 0)) };
  const catalogue: any = {
    getCategory: jest.fn((name: string) => (name === 'Toaster' ? Promise.reject(new NotFoundException('no category')) : Promise.resolve({ name }))),
    typeExists: jest.fn().mockResolvedValue(options.typeOk !== false),
  };
  return { service: new ConfigLocationService(model, units, catalogue), model, units, catalogue };
}

describe('ConfigLocationService', () => {
  it('lists locations with their project codes, never listing STOCK itself', async () => {
    const { service } = build({ docs: [{ ...hq(), projects: ['STOCK', 'PRJ-ALPHA'] }, { location: 'Partner A' }] });
    const all = await service.findAll();
    expect(all[0].projects).toEqual(['PRJ-ALPHA']);
    expect(all[1]).toEqual({ location: 'Partner A', item_access: [], image_access: [], hardware_access: [], projects: [] });
  });

  it('gives a location\'s projects with STOCK first', async () => {
    const { service } = build();
    expect(await service.getProjects('Meridian HQ')).toEqual(['STOCK', 'PRJ-ALPHA', 'PRJ-BRAVO']);
    expect(await service.getProjects('Partner A')).toEqual(['STOCK']);
    await expect(service.getProjects('Nowhere')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives the hardware and image access of a location, empty for an unknown one', async () => {
    const { service } = build();
    expect(await service.getAccessibleHardwareIDs('Meridian HQ')).toEqual(['m1']);
    expect(await service.getImageAccess('Meridian HQ')).toEqual(['i1']);
    expect(await service.getImageAccess('Nowhere')).toEqual([]);
    expect(await service.getAccessibleHardwareIDs('Nowhere')).toEqual([]);
  });

  describe('adding a location', () => {
    it('starts with nothing set up and no projects', async () => {
      const { service, model } = build();
      expect(await service.addEntry({ location: '  Partner   D ' })).toEqual({
        location: 'Partner D', item_access: [], image_access: [], hardware_access: [], projects: [],
      });
      expect(model.create).toHaveBeenCalled();
    });

    it('needs a name that is not already used', async () => {
      const { service } = build();
      await expect(service.addEntry({ location: ' ' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.addEntry({ location: 'meridian hq' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('saving a location\'s projects', () => {
    it('tidies the codes, drops STOCK and repeats', async () => {
      const { service, model } = build();
      await service.updateEntry({ location: 'Meridian HQ', projects: [' prj  alpha', 'PRJ-ALPHA', 'stock', 'PRJ-NEW', ''] });
      expect(model.findOneAndUpdate.mock.calls[0][1].$set.projects).toEqual(['PRJ ALPHA', 'PRJ-ALPHA', 'PRJ-NEW']);
    });

    it('refuses to remove a code a unit still uses, saying how many', async () => {
      const { service, model } = build({ used: { 'PRJ-BRAVO': 2 } });
      await expect(service.updateEntry({ location: 'Meridian HQ', projects: ['PRJ-ALPHA'] })).rejects.toThrow('PRJ-BRAVO is used by 2 units at Meridian HQ');
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
      await expect(build({ used: { 'PRJ-BRAVO': 1 } }).service.updateEntry({ location: 'Meridian HQ', projects: [] })).rejects.toThrow('1 unit at');
    });

    it('lets an unused code go', async () => {
      const { service } = build();
      expect((await service.updateEntry({ location: 'Meridian HQ', projects: ['PRJ-ALPHA'] })).projects).toEqual(['PRJ-ALPHA']);
    });

    it('leaves the projects alone when none are sent', async () => {
      const { service, model } = build();
      await service.updateEntry({ location: 'Meridian HQ', image_access: ['a', 'b'] });
      const set = model.findOneAndUpdate.mock.calls[0][1].$set;
      expect(set).toEqual({ image_access: ['a', 'b'] });
    });

    it('says when the location does not exist or the projects are not a list', async () => {
      const { service } = build();
      await expect(service.updateEntry({ location: 'Nowhere' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateEntry({ location: 'Meridian HQ', projects: 'x' as any })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('saving a location\'s hardware access', () => {
    it('keeps only types that exist in the catalogue', async () => {
      const { service, model, catalogue } = build();
      await service.updateEntry({ location: 'Meridian HQ', item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Bio PC', 'Bio PC'] }, { hardware_category: 'Other', hardware_type: [] }] });
      expect(model.findOneAndUpdate.mock.calls[0][1].$set.item_access).toEqual([{ hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Bio PC'] }]);
      expect(catalogue.getCategory).toHaveBeenCalledWith('PC');
    });

    it('refuses an unknown category or a type that is not in the category', async () => {
      await expect(build().service.updateEntry({ location: 'Meridian HQ', item_access: [{ hardware_category: 'Toaster', hardware_type: ['X'] }] })).rejects.toBeInstanceOf(NotFoundException);
      await expect(build({ typeOk: false }).service.updateEntry({ location: 'Meridian HQ', item_access: [{ hardware_category: 'PC', hardware_type: ['X'] }] })).rejects.toThrow('not a PC hardware type');
    });

    it('will not take a type away while the location has units of it', async () => {
      const { service } = build({ used: { 'Bio PC': 3 } });
      await expect(service.updateEntry({ location: 'Meridian HQ', item_access: [{ hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }] }))
        .rejects.toThrow('Meridian HQ still has 3 units of "Bio PC"');
    });
  });
});
