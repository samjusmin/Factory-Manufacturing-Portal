import { ConflictException, NotFoundException } from '@nestjs/common';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';

// A checklist category carries a version that goes up on every save; a save made from an older version is refused.
describe('FactoryAcceptanceTestService checklist versions', () => {
  const update = { project: 'P', phase: 'ph', unit: 'U1', category: 'Kiosk Common', checklist: [{ description: 'x' }] };
  let model: any;
  let service: FactoryAcceptanceTestService;

  const current = (version?: number) => ({
    exec: () => Promise.resolve([{ category: [{ name: 'Other' }, { name: 'Kiosk Common', ...(version === undefined ? {} : { version }) }] }]),
  });

  beforeEach(() => {
    model = {
      updateOne: jest.fn().mockResolvedValue({ n: 1, nModified: 1 }),
      find: jest.fn().mockReturnValue({ lean: () => current(3) }),
    };
    service = new FactoryAcceptanceTestService(model, { user: { company: 'tenant-a', username: 'sam' } } as any, {} as any, {} as any, { findOne: () => ({ lean: () => ({ exec: () => Promise.resolve({ name: 'Sam' }) }) }) } as any);
  });

  it('writes the checklist and raises the version, requiring the version the user loaded', async () => {
    await service.saveChecklist({ ...update, version: 3 }, update.checklist);
    const [filter, change, options] = model.updateOne.mock.calls[0];
    expect(filter).toEqual({ project: 'P', phase: 'ph', doc_no: 'U1' });
    expect(change.$set).toEqual({ 'category.$[element].checklists': update.checklist });
    expect(change.$inc).toEqual({ 'category.$[element].version': 1 });
    expect(options.arrayFilters).toEqual([{ 'element.name': 'Kiosk Common', 'element.version': 3 }]);
  });

  it('treats a category with no version yet as version 0', async () => {
    await service.saveChecklist({ ...update, version: 0 }, update.checklist);
    expect(model.updateOne.mock.calls[0][2].arrayFilters[0]['element.version']).toEqual({ $in: [0, null] });
  });

  it('refuses the write when someone else saved in the meantime (nothing was updated)', async () => {
    model.updateOne.mockResolvedValue({ n: 1, nModified: 0 });
    await expect(service.saveChecklist({ ...update, version: 3 }, update.checklist)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not check a save that names no version (older clients), but still raises the version', async () => {
    model.updateOne.mockResolvedValue({ n: 1, nModified: 0 });
    await expect(service.saveChecklist(update, update.checklist)).resolves.toBeDefined();
    expect(model.updateOne.mock.calls[0][2].arrayFilters).toEqual([{ 'element.name': 'Kiosk Common' }]);
    expect(model.updateOne.mock.calls[0][1].$inc).toBeDefined();
  });

  it('refuses a save made from an older version before doing anything else', async () => {
    await expect(service.assertChecklistVersion({ ...update, version: 2 })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.assertChecklistVersion({ ...update, version: 3 })).resolves.toBeDefined();
    await expect(service.assertChecklistVersion(update)).resolves.toBeDefined();
  });

  it('counts a missing version as 0 and complains about an unknown checklist', async () => {
    model.find.mockReturnValue({ lean: () => current(undefined) });
    await expect(service.assertChecklistVersion({ ...update, version: 0 })).resolves.toBeDefined();
    await expect(service.assertChecklistVersion({ ...update, category: 'Nope', version: 0 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not save at all when the version is stale', async () => {
    await expect(service.updateChecklist({ ...update, version: 1 })).rejects.toBeInstanceOf(ConflictException);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
