import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigCatalogueService, cleanChecklist, cleanName } from './config-catalogue.service';

// A tiny stand-in for a Mongoose model holding a list of documents, enough for the catalogue's queries.
function fakeModel(initial: any[] = []) {
  const docs: any[] = [...initial];
  const matches = (doc: any, filter: any) =>
    Object.entries(filter || {}).every(([key, value]: [string, any]) =>
      value && typeof value === 'object' && '$in' in value ? value.$in.includes(doc[key]) : doc[key] === value);
  const query = (result: () => any) => {
    const q: any = { sort: () => q, lean: () => q, exec: () => Promise.resolve(result()) };
    return q;
  };
  return {
    docs,
    find: jest.fn((filter?: any) => query(() => docs.filter((d) => matches(d, filter)).map((d) => ({ ...d })))),
    findOne: jest.fn((filter?: any) => query(() => {
      const found = docs.find((d) => matches(d, filter));
      return found ? { ...found } : null;
    })),
    countDocuments: jest.fn((filter?: any) => Promise.resolve(docs.filter((d) => matches(d, filter)).length)),
    create: jest.fn((doc: any) => { docs.push({ ...doc }); return Promise.resolve(doc); }),
    updateOne: jest.fn((filter: any, update: any) => {
      docs.filter((d) => matches(d, filter)).forEach((d) => Object.assign(d, update.$set));
      return Promise.resolve({});
    }),
    deleteOne: jest.fn((filter: any) => {
      const i = docs.findIndex((d) => matches(d, filter));
      if (i > -1) { docs.splice(i, 1); }
      return Promise.resolve({});
    }),
  };
}

const count = (n: number) => ({ countDocuments: jest.fn().mockResolvedValue(n) });

function build(options: { categories?: any[]; types?: any[]; units?: number; locations?: number; models?: number; images?: number } = {}) {
  const categories = fakeModel(options.categories || [
    { name: 'PC', icon: 'desktop', uses_image: true, parts: [] },
    { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2'] },
  ]);
  const types = fakeModel(options.types || [
    { category: 'PC', name: 'Kiosk A PC', checklist: [{ description: 'Check' }] },
    { category: 'UNIT-W1', name: 'UNIT-W1 Set', checklist: [] },
  ]);
  const service = new ConfigCatalogueService(
    categories as any, types as any, count(options.units || 0) as any, count(options.locations || 0) as any,
    count(options.models || 0) as any, count(options.images || 0) as any,
  );
  return { service, categories, types };
}

describe('catalogue helpers', () => {
  it('tidies a name', () => {
    expect(cleanName('  Network   Switch ')).toBe('Network Switch');
    expect(cleanName(undefined)).toBe('');
  });

  it('stores only the wording of each check and drops empty rows', () => {
    expect(cleanChecklist([
      { description: ' Install driver ', reference: ' ', status: 'Complete', checked_by: 'Alex', comment: 'x' },
      { description: '   ' },
      { description: 'Section', reference: 'Heading' },
    ])).toEqual([
      { description: 'Install driver', reference: null, status: null, checked_by: null, date_checked: null, comment: null },
      { description: 'Section', reference: 'Heading', status: null, checked_by: null, date_checked: null, comment: null },
    ]);
  });

  it('refuses a checklist that is not a list', () => {
    expect(() => cleanChecklist('nope')).toThrow(BadRequestException);
  });
});

describe('ConfigCatalogueService', () => {
  it('lists the categories with the names of their types', async () => {
    const { service } = build();
    expect(await service.catalogue()).toEqual({
      categories: [
        { name: 'PC', icon: 'desktop', uses_image: true, parts: [], types: ['Kiosk A PC'] },
        { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2'], types: ['UNIT-W1 Set'] },
      ],
    });
  });

  it('lists the types an image can be made for', async () => {
    const { service } = build();
    expect(await service.imageTypes()).toEqual(['Kiosk A PC']);
  });

  it('gives a type with its checklist, or says there is none', async () => {
    const { service } = build();
    expect(await service.getType('Kiosk A PC')).toEqual({ category: 'PC', name: 'Kiosk A PC', checklist: [{ description: 'Check' }] });
    await expect(service.getType('Toaster')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a category, tidying its name and parts', async () => {
    const { service, categories } = build();
    const result = await service.createCategory({ name: ' Light   Grids ', icon: 'tools', uses_image: 0, parts: ['Grid 2', ' grid 2 ', '', 'Grid 3'] });
    expect(categories.docs.pop()).toEqual({ name: 'Light Grids', icon: 'tools', uses_image: false, parts: ['Grid 2', 'Grid 3'] });
    expect(result.categories.map((c) => c.name)).toContain('Light Grids');
  });

  it('refuses a nameless category and a name already used (any letter case)', async () => {
    const { service } = build();
    await expect(service.createCategory({ name: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createCategory({ name: 'pc' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createCategory({ name: 'X', parts: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes what a category looks like', async () => {
    const { service, categories } = build();
    await service.updateCategory('UNIT-W1', { icon: 'tools', uses_image: true, parts: ['Member 1'] });
    expect(categories.docs[1]).toMatchObject({ icon: 'tools', uses_image: true, parts: ['Member 1'] });
    await expect(service.updateCategory('Toaster', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('will not delete a category that is still in use', async () => {
    await expect(build().service.deleteCategory('PC')).rejects.toThrow('still has hardware types');
    const empty = { categories: [{ name: 'Other', icon: 'box-open', uses_image: false, parts: [] }], types: [] };
    await expect(build({ ...empty, models: 2 }).service.deleteCategory('Other')).rejects.toThrow('hardware models');
    await expect(build({ ...empty, units: 1 }).service.deleteCategory('Other')).rejects.toThrow('still has units');
    const { service, categories } = build(empty);
    await service.deleteCategory('Other');
    expect(categories.docs.length).toBe(0);
  });

  it('adds a hardware type to a category', async () => {
    const { service, types } = build();
    await service.createType({ category: 'PC', name: ' Kiosk  B PC ', checklist: [{ description: 'Boot' }] });
    expect(types.docs.pop()).toMatchObject({ category: 'PC', name: 'Kiosk B PC', checklist: [{ description: 'Boot' }] });
  });

  it('starts a type with an empty checklist when none is given', async () => {
    const { service, types } = build();
    await service.createType({ category: 'PC', name: 'Bio PC' });
    expect(types.docs.pop().checklist).toEqual([]);
  });

  it('refuses a type with no name, in an unknown category, or a name already used', async () => {
    const { service } = build();
    await expect(service.createType({ category: 'PC', name: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createType({ category: 'Toaster', name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createType({ category: 'UNIT-W1', name: 'kiosk a pc' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('will not delete a type that has units, location access or images', async () => {
    await expect(build({ units: 3 }).service.deleteType('Kiosk A PC')).rejects.toThrow('has 3 units');
    await expect(build({ units: 1 }).service.deleteType('Kiosk A PC')).rejects.toThrow('has 1 unit,');
    await expect(build({ locations: 1 }).service.deleteType('Kiosk A PC')).rejects.toThrow('Edit Locations');
    await expect(build({ images: 1 }).service.deleteType('Kiosk A PC')).rejects.toThrow('Image List');
    const { service, types } = build();
    await service.deleteType('Kiosk A PC');
    expect(types.docs.map((t) => t.name)).toEqual(['UNIT-W1 Set']);
  });

  it('saves a type\'s checklist', async () => {
    const { service, types } = build();
    expect(await service.saveChecklist('Kiosk A PC', [{ description: 'One' }, { description: '' }, { description: 'Two', reference: 'Ref' }])).toEqual({ name: 'Kiosk A PC', rows: 2 });
    expect(types.docs[0].checklist.map((r) => r.description)).toEqual(['One', 'Two']);
    await expect(service.saveChecklist('Toaster', [])).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.saveChecklist('Kiosk A PC', undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});
