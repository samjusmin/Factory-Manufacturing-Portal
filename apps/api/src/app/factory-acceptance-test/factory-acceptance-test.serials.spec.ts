import { BadRequestException } from '@nestjs/common';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';

// A serial number already in use refuses the save: nothing is written, so no row is wiped and the version stays put.
describe('FactoryAcceptanceTestService serial numbers', () => {
  const rows = () => [
    { description: 'Console', comment: 'SER-1', status: 'Complete', checked_by: 'Alex', date_checked: 'd' },
    { description: 'Panel', comment: 'SER-2', status: 'Complete', checked_by: 'Alex', date_checked: 'd' },
    { description: 'Camera', comment: null, status: null, checked_by: null, date_checked: null },
  ];
  const update = (checklist: any[]) => ({ project: 'P', phase: 'ph', unit: 'U1', category: 'Serial Numbers', checklist, version: 3 });

  let model: any;
  let service: FactoryAcceptanceTestService;
  // The serial numbers another unit already has.
  let taken: string[];

  beforeEach(() => {
    taken = [];
    model = {
      updateOne: jest.fn().mockResolvedValue({ n: 1, nModified: 1 }),
      find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([{ category: [{ name: 'Serial Numbers', version: 3, checklists: rows().map((row) => ({ ...row, comment: null, status: null })) }] }]) }) }),
      aggregate: jest.fn((pipeline: any[]) => {
        const serial = pipeline.map((stage) => stage.$match && stage.$match['category.checklists.comment']).find((s) => s);
        return Promise.resolve(taken.includes(serial) ? [{}] : []);
      }),
    };
    service = new FactoryAcceptanceTestService(model, { user: { company: 'tenant-a', username: 'sam' } } as any, {} as any, {} as any, { findOne: () => ({ lean: () => ({ exec: () => Promise.resolve({ name: 'Sam' }) }) }) } as any);
  });

  async function refusal(checklist: any[]) {
    try {
      await service.updateChecklist(update(checklist));
    } catch (error) {
      return error;
    }
    throw new Error('The save should have been refused');
  }

  it('saves when every serial number is free', async () => {
    await service.updateChecklist(update(rows()));
    expect(model.updateOne).toHaveBeenCalledTimes(1);
  });

  it('refuses a serial number another unit has, naming the row, and saves nothing', async () => {
    taken = ['SER-2'];
    const error = await refusal(rows());
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse().duplicates).toEqual([{ index: 1, serial: 'SER-2', reason: 'existing' }]);
    expect(error.getResponse().message).toContain('SER-2');
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('leaves the rows as the user typed them', async () => {
    taken = ['SER-1'];
    const checklist = rows();
    await refusal(checklist);
    expect(checklist).toEqual(rows());
  });

  it('finds the same serial number twice on one form, whatever the letter case', async () => {
    const checklist = rows();
    checklist[1].comment = ' ser-1 ';
    const error = await refusal(checklist);
    expect(error.getResponse().duplicates).toEqual([{ index: 1, serial: 'SER-1', reason: 'form' }]);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('does not treat blank rows as duplicates of each other', async () => {
    const checklist = rows();
    checklist[0].comment = '';
    checklist[1].comment = '   ';
    await service.updateChecklist(update(checklist));
    expect(model.aggregate).not.toHaveBeenCalled();
    expect(model.updateOne).toHaveBeenCalledTimes(1);
  });

  it('reports every duplicate at once, and one request does not leak into the next', async () => {
    taken = ['SER-1', 'SER-2'];
    expect((await refusal(rows())).getResponse().duplicates.length).toBe(2);
    taken = [];
    await service.updateChecklist(update(rows()));
    expect(model.updateOne).toHaveBeenCalledTimes(1);
  });
});
