import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HardwareTypeService } from './hardware-type.service';

const q = (result: any) => {
  const query: any = { sort: () => query, lean: () => query, then: (ok: any, fail: any) => Promise.resolve(result).then(ok, fail) };
  return query;
};

function build(existing: any[] = [{ _id: 'm1', name: 'Dell 7000' }]) {
  const model: any = {
    find: jest.fn(() => q(existing)),
    findOneAndUpdate: jest.fn((filter: any, update: any) => q(existing.some((m) => m._id === filter._id) ? { _id: filter._id, ...update.$set } : null)),
    create: jest.fn((doc: any) => Promise.resolve({ toObject: () => doc })),
  };
  const catalogue: any = {
    getCategory: jest.fn((name: string) => (name === 'Toaster' ? Promise.reject(new NotFoundException('no category')) : Promise.resolve({ name }))),
  };
  return { service: new HardwareTypeService(model, catalogue), model, catalogue };
}

describe('HardwareTypeService', () => {
  it('lists the models a location may use for a category, by name', async () => {
    const { service, model } = build();
    await service.getAccessibleByCategory(['m1'], 'PC');
    expect(model.find).toHaveBeenCalledWith({ _id: { $in: ['m1'] }, config_type: 'PC' }, { name: 1, _id: 0 });
  });

  it('adds a model with a string id, so location access can refer to it', async () => {
    const { service } = build();
    const created: any = await service.updateHardwareType({ name: ' Dell  7090 ', config_type: ['PC'] });
    expect(created).toMatchObject({ name: 'Dell 7090', config_type: ['PC'] });
    expect(typeof created._id).toBe('string');
    expect(created._id).toMatch(/^[0-9a-f]{24}$/);
  });

  it('changes an existing model and returns it', async () => {
    const { service } = build();
    expect(await service.updateHardwareType({ _id: 'm1', name: 'Dell 7000 SFF', config_type: ['PC'] })).toEqual({ _id: 'm1', name: 'Dell 7000 SFF', config_type: ['PC'] });
    await expect(service.updateHardwareType({ _id: 'gone', name: 'X', config_type: ['PC'] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('needs a name and a category that exists in the catalogue', async () => {
    const { service } = build();
    await expect(service.updateHardwareType({ name: ' ', config_type: ['PC'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateHardwareType({ name: 'X', config_type: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateHardwareType({ name: 'X', config_type: ['Toaster'] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a name another model already has, but not the model\'s own', async () => {
    const { service } = build();
    await expect(service.updateHardwareType({ name: 'dell 7000', config_type: ['PC'] })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.updateHardwareType({ _id: 'm1', name: 'Dell 7000', config_type: ['PC'] })).resolves.toBeTruthy();
  });
});
