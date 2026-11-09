import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PcImageService } from './pc-image.service';

const q = (result: any) => {
  const query: any = { sort: () => query, lean: () => query, then: (ok: any, fail: any) => Promise.resolve(result).then(ok, fail) };
  return query;
};

const image = (extra: any = {}) => ({
  name: 'KioskA_v3', description: 'Standard build', added_by: 'admin', responsible_person: 'Alex',
  pc_type: 'Kiosk A PC', date_created: '2026-09-01', ...extra,
});

function build(existing: any[] = []) {
  const model: any = {
    find: jest.fn((filter: any) => q(filter && filter.name ? existing.filter((i) => i.name === filter.name) : existing)),
    findOneAndUpdate: jest.fn((filter: any, update: any) => q(existing.length ? { ...update.$set } : null)),
    create: jest.fn((doc: any) => Promise.resolve(doc)),
  };
  const catalogue: any = { imageTypes: jest.fn().mockResolvedValue(['Kiosk A PC', 'Bio PC']) };
  return { service: new PcImageService(model, catalogue), model, catalogue };
}

describe('PcImageService', () => {
  it('finds the images among some ids that are for one hardware type, ignoring bad ids', async () => {
    const { service, model } = build();
    const id = new Types.ObjectId();
    await service.getImageByIds([id.toHexString(), 'bad'], 'Kiosk A PC');
    const filter = model.find.mock.calls[0][0];
    expect(filter.pc_type).toBe('Kiosk A PC');
    expect(filter._id.$in.map(String)).toEqual([id.toHexString()]);
    await service.getImageByIds(undefined, 'Kiosk A PC');
    expect(model.find.mock.calls[1][0]._id.$in).toEqual([]);
  });

  it('adds an image for a hardware type that uses images, tidying the text', async () => {
    const { service, model } = build();
    await service.updateImage(image({ name: '  KioskA_v4 ', description: ' New   build ' }));
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'KioskA_v4', description: 'New build', pc_type: 'Kiosk A PC' }));
  });

  it('changes an existing image', async () => {
    const id = new Types.ObjectId().toHexString();
    const { service } = build([{ _id: id, name: 'KioskA_v3' }]);
    expect(await service.updateImage({ id, ...image() })).toMatchObject({ name: 'KioskA_v3' });
    await expect(service.updateImage({ id: 'bad', ...image({ name: 'Other' }) })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('needs every detail, and a hardware type that uses images', async () => {
    const { service } = build();
    await expect(service.updateImage(image({ responsible_person: ' ' }))).rejects.toThrow('responsible_person');
    await expect(service.updateImage(image({ pc_type: 'Network Switch' }))).rejects.toThrow('not a hardware type that uses a PC image');
    await expect(service.updateImage(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a name another image already has', async () => {
    const { service } = build([{ _id: new Types.ObjectId(), name: 'KioskA_v3' }]);
    await expect(service.updateImage(image())).rejects.toBeInstanceOf(ConflictException);
  });
});
